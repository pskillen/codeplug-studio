/**
 * UV-17Pro family CloneImageRadio — PROGRAM+R/W handshake, multi-region download/upload.
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
import type { Uv17ProLayout } from './layout.ts';
import { uv17ProCrypt } from './crypt.ts';
import {
  decodeChannelsFromImage,
  encodeChannelsIntoImage,
  readFirmwareFromImage,
} from './channelCodec.ts';

type HandshakeMode = 'read' | 'upload';

export interface Uv17ProConnectOptions {
  signal?: AbortSignal;
  settleScale?: number;
  handshake?: 'read' | 'none';
}

function scaledMs(baseMs: number, scale: number): number {
  if (scale <= 0) return 0;
  return Math.round(baseMs * scale);
}

async function delay(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  if (ms <= 0) return;
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

function packedOffsetForRadioAddr(layout: Uv17ProLayout, radioAddr: number): number {
  let packed = 0;
  for (let i = 0; i < layout.memStarts.length; i++) {
    const start = layout.memStarts[i]!;
    const size = layout.memSizes[i]!;
    if (radioAddr >= start && radioAddr < start + size) {
      return packed + (radioAddr - start);
    }
    packed += size;
  }
  throw new RangeError(`Radio address 0x${radioAddr.toString(16)} not in MEM_* regions`);
}

function listRadioBlockAddresses(layout: Uv17ProLayout): number[] {
  const addrs: number[] = [];
  for (let i = 0; i < layout.memStarts.length; i++) {
    const start = layout.memStarts[i]!;
    const size = layout.memSizes[i]!;
    for (let off = 0; off < size; off += layout.blockSize) {
      addrs.push(start + off);
    }
  }
  return addrs;
}

async function waitForReadResponse(
  pipe: BytePipe,
  readResponseLen: number,
  timeoutMs: number,
): Promise<Uint8Array> {
  const deadline = Date.now() + timeoutMs;
  const pending: number[] = [];
  while (Date.now() < deadline) {
    while (pending.length > 0 && pending[0] !== 0x52) {
      pending.shift();
    }
    if (pending.length >= readResponseLen) {
      return new Uint8Array(pending.splice(0, readResponseLen));
    }
    const remaining = Math.max(1, deadline - Date.now());
    const byte = await pipe.readExact(1, remaining);
    pending.push(byte[0]!);
  }
  throw new RadioTimeoutError(
    `Timeout waiting for read response (${readResponseLen} bytes). Have ${pending.length} bytes.`,
  );
}

async function runMagics(
  layout: Uv17ProLayout,
  pipe: BytePipe,
  mode: HandshakeMode,
  signal?: AbortSignal,
): Promise<void> {
  const magics = mode === 'read' ? layout.magics.read : layout.magics.upload;
  for (const { send, responseLen } of magics) {
    throwIfAborted(signal);
    await flushPipe(pipe);
    await pipe.write(send);
    await pipe.readExact(responseLen, layout.ioTimeoutMs);
  }
}

async function handshake(
  layout: Uv17ProLayout,
  pipe: BytePipe,
  mode: HandshakeMode,
  opts?: Uv17ProConnectOptions,
): Promise<void> {
  const signal = opts?.signal;
  const skipPortSettle = mode === 'upload';
  const scale = skipPortSettle ? 0 : (opts?.settleScale ?? 1);
  throwIfAborted(signal);
  if (!skipPortSettle) {
    await delay(scaledMs(layout.initDelayMs, scale), signal);
  }
  await flushPipe(pipe);
  if (!skipPortSettle) {
    await delay(scaledMs(layout.clearBufferDelayMs, scale), signal);
  }
  try {
    await sendIdent(pipe, layout.ident, layout.identTimeoutMs);
  } catch (err) {
    throw new RadioWrongIdentError(
      err instanceof Error
        ? `${layout.protocolLabel} ident failed: ${err.message}`
        : `${layout.protocolLabel} ident failed`,
    );
  }
  await runMagics(layout, pipe, mode, signal);
}

export class Uv17ProProtocol implements CloneImageRadio {
  private pipe: BytePipe | null = null;

  constructor(private readonly layout: Uv17ProLayout) {}

  async connect(pipe: BytePipe, opts?: Uv17ProConnectOptions): Promise<IdentResult> {
    this.pipe = pipe;
    if (opts?.handshake !== 'none') {
      await handshake(this.layout, pipe, 'read', opts);
    }
    return {
      raw: this.layout.ident.slice(),
      modelHints: [...this.layout.modelHints],
    };
  }

  async disconnect(): Promise<void> {
    this.pipe = null;
  }

  private requirePipe(): BytePipe {
    if (!this.pipe) {
      throw new RadioProtocolError(
        `${this.layout.protocolLabel} not connected — call connect() first`,
      );
    }
    return this.pipe;
  }

  private async readBlock(pipe: BytePipe, radioAddr: number): Promise<Uint8Array> {
    const frame = makeProgramRwReadFrame(radioAddr, this.layout.blockSize);
    await pipe.write(frame);
    const readResponseLen = 4 + this.layout.blockSize;
    const raw = await waitForReadResponse(pipe, readResponseLen, this.layout.ioTimeoutMs);
    const encrypted = parseProgramRwReadReply(raw, this.layout.blockSize);
    return uv17ProCrypt(encrypted, this.layout.defaultEncrsym);
  }

  private async writeBlock(pipe: BytePipe, radioAddr: number, plain: Uint8Array): Promise<void> {
    if (plain.length !== this.layout.blockSize) {
      throw new RangeError(`Block must be ${this.layout.blockSize} bytes`);
    }
    await flushPipe(pipe);
    const encrypted = uv17ProCrypt(plain, this.layout.defaultEncrsym);
    const frame = makeProgramRwWriteFrame(radioAddr, this.layout.blockSize, encrypted);
    await pipe.write(frame);
    await expectAck(pipe, this.layout.writeAckTimeoutMs);
  }

  async download(opts: { onProgress?: ProgressFn; signal?: AbortSignal }): Promise<MemoryMap> {
    const pipe = this.requirePipe();
    const addrs = listRadioBlockAddresses(this.layout);
    const image = createMemoryMap(this.layout.memTotal);
    let done = 0;
    const max = this.layout.cloneBlockCount;
    for (const addr of addrs) {
      throwIfAborted(opts.signal);
      const block = await this.readBlock(pipe, addr);
      const packed = packedOffsetForRadioAddr(this.layout, addr);
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
    if (image.size < this.layout.memTotal) {
      throw new RangeError(`Upload image must be at least 0x${this.layout.memTotal.toString(16)}`);
    }
    const pipe = this.requirePipe();
    const addrs = listRadioBlockAddresses(this.layout);
    reportProgress(
      opts.onProgress,
      { cur: 0, max: addrs.length, msg: 'Upload handshake' },
      opts.signal,
    );
    await handshake(this.layout, pipe, 'upload', { signal: opts.signal });
    let done = 0;
    const max = addrs.length;
    for (const addr of addrs) {
      throwIfAborted(opts.signal);
      const packed = packedOffsetForRadioAddr(this.layout, addr);
      const plain = image.get(packed, this.layout.blockSize);
      await this.writeBlock(pipe, addr, plain);
      done += 1;
      reportProgress(
        opts.onProgress,
        { cur: done, max, msg: `Writing 0x${addr.toString(16)}` },
        opts.signal,
      );
    }
  }

  decodeChannels(image: MemoryMap): RadioChannelDto[] {
    return decodeChannelsFromImage(this.layout, image);
  }

  encodeChannels(image: MemoryMap, channels: readonly RadioChannelDto[]): MemoryMap {
    const next = memoryMapFromBytes(image.bytes);
    encodeChannelsIntoImage(this.layout, next, channels);
    if (next.size < this.layout.channelSpan) {
      throw new RangeError('Image too small for channel encode');
    }
    return next;
  }

  readFirmware(image: MemoryMap): string | undefined {
    return readFirmwareFromImage(this.layout, image);
  }
}

export function createUv17ProProtocol(layout: Uv17ProLayout): CloneImageRadio {
  return new Uv17ProProtocol(layout);
}
