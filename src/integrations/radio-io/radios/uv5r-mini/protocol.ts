/**
 * UV-5R Mini CloneImageRadio — PROGRAM+R/W handshake, multi-region download/upload.
 * Cite: NeonPlug serialConnection.ts / protocol.ts (MIT); CHIRP facts only.
 */

import type { BytePipe, CloneImageRadio, IdentResult, MemoryMap, ProgressFn } from '../../types.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import {
  expectAck,
  makeProgramRwReadFrame,
  makeProgramRwWriteFrame,
  parseProgramRwReadReply,
  sendIdent,
} from '../../kit/codecs/programRw.ts';
import { createMemoryMap, memoryMapFromBytes } from '../../kit/memoryMap.ts';
import { RadioProtocolError, RadioTimeoutError, RadioWrongIdentError } from '../../kit/errors.ts';
import { reportProgress, throwIfAborted } from '../../kit/progress.ts';
import {
  UV5R_MINI_BLOCK_SIZE,
  UV5R_MINI_CHANNEL_SPAN,
  UV5R_MINI_CLEAR_BUFFER_DELAY_MS,
  UV5R_MINI_CLONE_BLOCK_COUNT,
  UV5R_MINI_IDENT,
  UV5R_MINI_IDENT_TIMEOUT_MS,
  UV5R_MINI_INIT_DELAY_MS,
  UV5R_MINI_IO_TIMEOUT_MS,
  UV5R_MINI_MEM_SIZES,
  UV5R_MINI_MEM_STARTS,
  UV5R_MINI_MEM_TOTAL,
  UV5R_MINI_READ_RESPONSE_LEN,
  UV5R_MINI_WRITE_ACK_TIMEOUT_MS,
} from './constants.ts';
import { uv5rMiniCrypt } from './crypt.ts';
import { UV5R_MINI_MAGICS_READ, UV5R_MINI_MAGICS_UPLOAD } from './magics.ts';
import {
  decodeChannelsFromImage,
  encodeChannelsIntoImage,
  readFirmwareFromImage,
} from './channelCodec.ts';

type HandshakeMode = 'read' | 'upload';

export interface Uv5rMiniConnectOptions {
  signal?: AbortSignal;
  /** Multiply NeonPlug settle delays (tests use 0). Default 1. */
  settleScale?: number;
}

function scaledMs(baseMs: number, scale: number): number {
  if (scale <= 0) {
    return 0;
  }
  return Math.round(baseMs * scale);
}

async function delay(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  if (ms <= 0) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(t);
      reject(signal?.reason ?? new Error('aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
  throwIfAborted(signal);
}

async function flushPipe(pipe: BytePipe): Promise<void> {
  if (pipe.flush) {
    await pipe.flush();
  }
}

function packedOffsetForRadioAddr(radioAddr: number): number {
  let packed = 0;
  for (let i = 0; i < UV5R_MINI_MEM_STARTS.length; i++) {
    const start = UV5R_MINI_MEM_STARTS[i]!;
    const size = UV5R_MINI_MEM_SIZES[i]!;
    if (radioAddr >= start && radioAddr < start + size) {
      return packed + (radioAddr - start);
    }
    packed += size;
  }
  throw new RangeError(`Radio address 0x${radioAddr.toString(16)} not in MEM_* regions`);
}

function listRadioBlockAddresses(): number[] {
  const addrs: number[] = [];
  for (let i = 0; i < UV5R_MINI_MEM_STARTS.length; i++) {
    const start = UV5R_MINI_MEM_STARTS[i]!;
    const size = UV5R_MINI_MEM_SIZES[i]!;
    for (let off = 0; off < size; off += UV5R_MINI_BLOCK_SIZE) {
      addrs.push(start + off);
    }
  }
  return addrs;
}

/** Drain until buffer starts with 0x52, then read 68 bytes (NeonPlug waitForReadResponse). */
async function waitForReadResponse(pipe: BytePipe, timeoutMs: number): Promise<Uint8Array> {
  const deadline = Date.now() + timeoutMs;
  const pending: number[] = [];
  while (Date.now() < deadline) {
    while (pending.length > 0 && pending[0] !== 0x52) {
      pending.shift();
    }
    if (pending.length >= UV5R_MINI_READ_RESPONSE_LEN) {
      return new Uint8Array(pending.splice(0, UV5R_MINI_READ_RESPONSE_LEN));
    }
    const remaining = Math.max(1, deadline - Date.now());
    const byte = await pipe.readExact(1, remaining);
    pending.push(byte[0]!);
  }
  throw new RadioTimeoutError(
    `Timeout waiting for read response (${UV5R_MINI_READ_RESPONSE_LEN} bytes). Have ${pending.length} bytes.`,
  );
}

async function runMagics(pipe: BytePipe, mode: HandshakeMode, signal?: AbortSignal): Promise<void> {
  const magics = mode === 'read' ? UV5R_MINI_MAGICS_READ : UV5R_MINI_MAGICS_UPLOAD;
  for (const { send, responseLen } of magics) {
    throwIfAborted(signal);
    await flushPipe(pipe);
    await pipe.write(send);
    await pipe.readExact(responseLen, UV5R_MINI_IO_TIMEOUT_MS);
  }
}

async function handshake(
  pipe: BytePipe,
  mode: HandshakeMode,
  opts?: Uv5rMiniConnectOptions,
): Promise<void> {
  const scale = opts?.settleScale ?? 1;
  const signal = opts?.signal;
  throwIfAborted(signal);
  await delay(scaledMs(UV5R_MINI_INIT_DELAY_MS, scale), signal);
  await flushPipe(pipe);
  await delay(scaledMs(UV5R_MINI_CLEAR_BUFFER_DELAY_MS, scale), signal);
  try {
    await sendIdent(pipe, UV5R_MINI_IDENT, UV5R_MINI_IDENT_TIMEOUT_MS);
  } catch (err) {
    throw new RadioWrongIdentError(
      err instanceof Error ? `UV-5R Mini ident failed: ${err.message}` : 'UV-5R Mini ident failed',
    );
  }
  await runMagics(pipe, mode, signal);
}

async function readBlock(pipe: BytePipe, radioAddr: number): Promise<Uint8Array> {
  const frame = makeProgramRwReadFrame(radioAddr, UV5R_MINI_BLOCK_SIZE);
  await pipe.write(frame);
  const raw = await waitForReadResponse(pipe, UV5R_MINI_IO_TIMEOUT_MS);
  const encrypted = parseProgramRwReadReply(raw, UV5R_MINI_BLOCK_SIZE);
  return uv5rMiniCrypt(encrypted);
}

async function writeBlock(pipe: BytePipe, radioAddr: number, plain: Uint8Array): Promise<void> {
  if (plain.length !== UV5R_MINI_BLOCK_SIZE) {
    throw new RangeError(`Block must be ${UV5R_MINI_BLOCK_SIZE} bytes`);
  }
  await flushPipe(pipe);
  const encrypted = uv5rMiniCrypt(plain);
  const frame = makeProgramRwWriteFrame(radioAddr, UV5R_MINI_BLOCK_SIZE, encrypted);
  await pipe.write(frame);
  await expectAck(pipe, UV5R_MINI_WRITE_ACK_TIMEOUT_MS);
}

export class Uv5rMiniProtocol implements CloneImageRadio {
  private pipe: BytePipe | null = null;

  async connect(pipe: BytePipe, opts?: Uv5rMiniConnectOptions): Promise<IdentResult> {
    this.pipe = pipe;
    await handshake(pipe, 'read', opts);
    return {
      raw: UV5R_MINI_IDENT.slice(),
      modelHints: ['UV5R-Mini', 'UV-5R Mini'],
    };
  }

  async disconnect(): Promise<void> {
    this.pipe = null;
  }

  private requirePipe(): BytePipe {
    if (!this.pipe) {
      throw new RadioProtocolError('UV-5R Mini not connected — call connect() first');
    }
    return this.pipe;
  }

  async download(opts: { onProgress?: ProgressFn; signal?: AbortSignal }): Promise<MemoryMap> {
    const pipe = this.requirePipe();
    const addrs = listRadioBlockAddresses();
    const image = createMemoryMap(UV5R_MINI_MEM_TOTAL);
    let done = 0;
    const max = UV5R_MINI_CLONE_BLOCK_COUNT;
    for (const addr of addrs) {
      throwIfAborted(opts.signal);
      const block = await readBlock(pipe, addr);
      const packed = packedOffsetForRadioAddr(addr);
      image.set(packed, block);
      done += 1;
      reportProgress(
        opts.onProgress,
        { cur: done, max, msg: `Reading 0x${addr.toString(16)}` },
        opts.signal,
      );
    }
    return image;
  }

  async upload(
    image: MemoryMap,
    opts: { onProgress?: ProgressFn; signal?: AbortSignal },
  ): Promise<void> {
    if (image.size < UV5R_MINI_MEM_TOTAL) {
      throw new RangeError(`Upload image must be at least 0x${UV5R_MINI_MEM_TOTAL.toString(16)}`);
    }
    const pipe = this.requirePipe();
    await handshake(pipe, 'upload', { signal: opts.signal });

    // Upload all MEM_* regions so settings/VFO/ANI from the hydrated image survive.
    const addrs = listRadioBlockAddresses();
    let done = 0;
    const max = addrs.length;
    for (const addr of addrs) {
      throwIfAborted(opts.signal);
      const packed = packedOffsetForRadioAddr(addr);
      const plain = image.get(packed, UV5R_MINI_BLOCK_SIZE);
      await writeBlock(pipe, addr, plain);
      done += 1;
      reportProgress(
        opts.onProgress,
        { cur: done, max, msg: `Writing 0x${addr.toString(16)}` },
        opts.signal,
      );
    }
  }

  decodeChannels(image: MemoryMap): RadioChannelDto[] {
    return decodeChannelsFromImage(image);
  }

  encodeChannels(image: MemoryMap, channels: readonly RadioChannelDto[]): MemoryMap {
    const next = memoryMapFromBytes(image.bytes);
    encodeChannelsIntoImage(next, channels);
    // Ensure non-channel bytes outside channel span are preserved (copy already did).
    if (next.size < UV5R_MINI_CHANNEL_SPAN) {
      throw new RangeError('Image too small for channel encode');
    }
    return next;
  }

  readFirmware(image: MemoryMap): string | undefined {
    return readFirmwareFromImage(image);
  }
}

export function createUv5rMiniProtocol(): CloneImageRadio {
  return new Uv5rMiniProtocol();
}
