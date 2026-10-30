/**
 * DM-32UV RadioFoundry codeplug over the programming cable.
 *
 * Debug-link command 0x1C (CODEPLUG), direct mode, image offsets.
 * RadioFoundry docs/spec/cps-fast.md and docs/spec/debuglink.md §2 and §3.20.
 * The radio adds 0x700000. This module never sends that base, never speaks the
 * OpenGD77 R/X/W codec, and never falls through to the stock DM-32 PROGRAM writer.
 * COMMIT reloads the codeplug. There is no reboot command.
 */

import type { AssembledBuild } from '@core/services/assemble.ts';
import { crc32Ieee } from '../../kit/checksums.ts';
import { RadioProtocolError, RadioTimeoutError } from '../../kit/errors.ts';
import { memoryMapFromBytes } from '../../kit/memoryMap.ts';
import { reportProgress } from '../../kit/progress.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import type { BytePipe, CloneImageRadio, IdentResult, MemoryMap, ProgressFn } from '../../types.ts';
import {
  BLOCK_SIZE,
  CODEPLUG_COMMAND,
  DATA_CHUNK_MAX,
  DM32_RADIOFOUNDRY_IMAGE_SIZE,
  EEPROM_IMAGE_END,
  FMT_BLANK,
  FMT_LZ4,
  FLASH_IMAGE_START,
  HANDSHAKE_ERROR,
  MODE_DIRECT,
  OP_ABORT,
  OP_BEGIN,
  OP_BLOCK,
  OP_COMMIT,
  OP_DATA,
  OP_END,
  OP_INFO,
  OP_READ,
  OP_SUMS,
  PHYSICAL_CODEPLUG_BASE,
  servedBlockAddresses,
} from './constants.ts';
import { decodeDebugFrame, encodeDebugFrame, type DebugFrame } from './frame.ts';
import { decodeBlock, encodeBlock } from './lz4.ts';
import {
  radioFoundryWriteSourceFromAssembled,
  type Dm32RadioFoundryWriteSource,
} from './writeSource.ts';

const REPLY_COMMAND = CODEPLUG_COMMAND | 0x80;
const PRE_WRITE_STAGE = 'Pre-write read';
const BLOCKS_STAGE = 'Codeplug blocks';
const COMMIT_STAGE = 'Commit';

interface FastInfo {
  dataChunk: number;
  readMax: number;
  sumsMax: number;
}

interface BlockSum {
  crc: number;
  blank: boolean;
}

export class Dm32uvRadioFoundryProtocol implements CloneImageRadio {
  private pipe: BytePipe | null = null;
  private seq = 1;
  private info: FastInfo | null = null;
  private readBlocks: Map<number, Uint8Array> | null = null;
  private armed: Dm32RadioFoundryWriteSource | null = null;

  async connect(pipe: BytePipe): Promise<IdentResult> {
    this.pipe = pipe;
    this.seq = 1;
    this.info = null;
    this.readBlocks = null;
    try {
      const body = await this.request(OP_INFO, new Uint8Array(0), 2000);
      this.info = parseInfo(body);
    } catch (err) {
      this.pipe = null;
      if (err instanceof RadioProtocolError && err.message === HANDSHAKE_ERROR) throw err;
      throw new RadioProtocolError(HANDSHAKE_ERROR);
    }
    return { raw: new Uint8Array(0), modelHints: ['DM-32UV RadioFoundry'] };
  }

  async disconnect(): Promise<void> {
    this.pipe = null;
    this.info = null;
    this.readBlocks = null;
    this.armed = null;
  }

  /** Remember the serialised codeplug. Upload overlays only its owned addresses. */
  armWriteSource(source: Dm32RadioFoundryWriteSource): void {
    if (
      source.bytes.length !== DM32_RADIOFOUNDRY_IMAGE_SIZE ||
      source.owned.length !== DM32_RADIOFOUNDRY_IMAGE_SIZE
    ) {
      throw new RadioProtocolError('RadioFoundry write image is the wrong length.');
    }
    this.armed = source;
  }

  armAssembled(assembled: AssembledBuild): Dm32RadioFoundryWriteSource {
    const source = radioFoundryWriteSourceFromAssembled(assembled);
    this.armWriteSource(source);
    return source;
  }

  hasReadImage(): boolean {
    return this.readBlocks != null;
  }

  async download(opts: {
    onProgress?: ProgressFn;
    signal?: AbortSignal;
    progressStage?: string;
  }): Promise<MemoryMap> {
    this.requireLink();
    const stage = opts.progressStage ?? 'Codeplug';
    const addresses = servedBlockAddresses();
    const sums = await this.readSums(addresses, opts.signal);
    const image = new Uint8Array(DM32_RADIOFOUNDRY_IMAGE_SIZE);
    image.fill(0xff);
    const blocks = new Map<number, Uint8Array>();
    for (let i = 0; i < addresses.length; i += 1) {
      const addr = addresses[i]!;
      const sum = sums.get(addr);
      if (!sum) throw new RadioProtocolError(`No checksum for block ${hex(addr)}.`);
      const block = sum.blank ? blankBlock() : await this.readBlock(addr, sum.crc, opts.signal);
      if (crc32Ieee(block) !== sum.crc) {
        throw new RadioProtocolError(`Block ${hex(addr)} checksum does not match the radio.`);
      }
      blocks.set(addr, block);
      const n = Math.min(BLOCK_SIZE, DM32_RADIOFOUNDRY_IMAGE_SIZE - addr);
      image.set(block.subarray(0, n), addr);
      reportProgress(
        opts.onProgress,
        {
          cur: i + 1,
          max: addresses.length,
          stage,
          msg: 'Reading codeplug',
        },
        opts.signal,
      );
    }
    this.readBlocks = blocks;
    return memoryMapFromBytes(image);
  }

  /** Image the next upload would send: radio bytes, with owned addresses replaced. */
  overlayWriteImage(): MemoryMap {
    const blocks = this.requireReadBlocks();
    const source = this.requireArmed();
    const image = new Uint8Array(DM32_RADIOFOUNDRY_IMAGE_SIZE);
    image.fill(0xff);
    for (const addr of servedBlockAddresses()) {
      const merged = mergeBlock(blocks.get(addr)!, addr, source);
      const n = Math.min(BLOCK_SIZE, DM32_RADIOFOUNDRY_IMAGE_SIZE - addr);
      image.set(merged.subarray(0, n), addr);
    }
    return memoryMapFromBytes(image);
  }

  async upload(
    image: MemoryMap,
    opts: { onProgress?: ProgressFn; signal?: AbortSignal },
  ): Promise<void> {
    void image;
    this.requireArmed();
    if (!this.readBlocks) {
      await this.download({ ...opts, progressStage: PRE_WRITE_STAGE });
    }
    const jobs = this.changedBlocks();
    if (jobs.length === 0) {
      reportProgress(
        opts.onProgress,
        { cur: 1, max: 1, stage: BLOCKS_STAGE, msg: 'No codeplug blocks changed' },
        opts.signal,
      );
    }
    await this.request(OP_BEGIN, Uint8Array.of(MODE_DIRECT), 2000);
    try {
      for (let i = 0; i < jobs.length; i += 1) {
        const job = jobs[i]!;
        await this.writeBlock(job.addr, job.data, opts.signal);
        reportProgress(
          opts.onProgress,
          {
            cur: i + 1,
            max: jobs.length,
            stage: BLOCKS_STAGE,
            msg: 'Writing codeplug',
          },
          opts.signal,
        );
      }
    } catch (err) {
      await this.request(OP_ABORT, new Uint8Array(0), 2000).catch(() => undefined);
      throw err;
    }
    reportProgress(
      opts.onProgress,
      { cur: 1, max: 1, stage: COMMIT_STAGE, msg: 'Committing codeplug' },
      opts.signal,
    );
    await this.request(OP_COMMIT, new Uint8Array(0), 20000);
    this.readBlocks = null;
  }

  decodeChannels(image: MemoryMap): RadioChannelDto[] {
    void image;
    return [];
  }

  encodeChannels(image: MemoryMap, channels: readonly RadioChannelDto[]): MemoryMap {
    void channels;
    return image;
  }

  readFirmware(image: MemoryMap): string | undefined {
    void image;
    return undefined;
  }

  private changedBlocks(): { addr: number; data: Uint8Array }[] {
    const blocks = this.requireReadBlocks();
    const source = this.requireArmed();
    const jobs: { addr: number; data: Uint8Array }[] = [];
    for (const addr of servedBlockAddresses()) {
      const radio = blocks.get(addr);
      if (!radio) throw new RadioProtocolError(`Block ${hex(addr)} was not read.`);
      const want = mergeBlock(radio, addr, source);
      if (!sameBytes(want, radio)) jobs.push({ addr, data: want });
    }
    return jobs;
  }

  private async readSums(
    addresses: number[],
    signal?: AbortSignal,
  ): Promise<Map<number, BlockSum>> {
    const info = this.requireInfo();
    const out = new Map<number, BlockSum>();
    let i = 0;
    while (i < addresses.length) {
      let count = 1;
      while (
        count < info.sumsMax &&
        i + count < addresses.length &&
        addresses[i + count] === addresses[i]! + count * BLOCK_SIZE
      ) {
        count += 1;
      }
      const start = addresses[i]!;
      assertImageBlock(start);
      const args = new Uint8Array(5);
      writeU32(args, 0, start);
      args[4] = count;
      const body = await this.request(OP_SUMS, args, 4000);
      if (body.length < 7 + count * 4) {
        throw new RadioProtocolError('RadioFoundry checksum reply is too short.');
      }
      const mask = body[5]! | (body[6]! << 8);
      for (let j = 0; j < count; j += 1) {
        const crc = readU32(body, 7 + j * 4);
        out.set(start + j * BLOCK_SIZE, { crc, blank: ((mask >> j) & 1) === 1 });
      }
      i += count;
      if (signal?.aborted) throw new RadioProtocolError('Radio I/O operation was aborted.');
    }
    return out;
  }

  private async readBlock(
    addr: number,
    expectCrc: number,
    signal?: AbortSignal,
  ): Promise<Uint8Array> {
    assertImageBlock(addr);
    const info = this.requireInfo();
    let stream = new Uint8Array(0);
    let total: number | null = null;
    let crc = 0;
    let format = 0;
    while (total === null || stream.length < total) {
      const args = new Uint8Array(6);
      writeU32(args, 0, addr);
      args[4] = stream.length & 0xff;
      args[5] = (stream.length >> 8) & 0xff;
      const body = await this.request(OP_READ, args, 4000);
      if (body.length < 13) throw new RadioProtocolError(`Block ${hex(addr)} read is too short.`);
      const gotAddr = readU32(body, 0);
      const fmt = body[4]!;
      const length = body[5]! | (body[6]! << 8);
      const gotCrc = readU32(body, 7);
      const offset = body[11]! | (body[12]! << 8);
      if (gotAddr !== addr || offset !== stream.length) {
        throw new RadioProtocolError(`Block ${hex(addr)} read window does not match.`);
      }
      if (total !== null && (gotCrc !== crc || length !== total)) {
        throw new RadioProtocolError(`Block ${hex(addr)} changed while it was being read.`);
      }
      format = fmt;
      total = length;
      crc = gotCrc;
      if (format === FMT_BLANK) break;
      const chunk = body.subarray(13, Math.min(body.length, 13 + info.readMax));
      if (chunk.length === 0) {
        throw new RadioProtocolError(`Block ${hex(addr)} read returned no bytes.`);
      }
      const next = new Uint8Array(stream.length + chunk.length);
      next.set(stream, 0);
      next.set(chunk, stream.length);
      stream = next;
      if (signal?.aborted) throw new RadioProtocolError('Radio I/O operation was aborted.');
    }
    if (crc !== expectCrc) {
      throw new RadioProtocolError(`Block ${hex(addr)} checksum changed while it was being read.`);
    }
    if (format === FMT_BLANK) return blankBlock();
    const data = decodeBlock(stream, BLOCK_SIZE);
    if (crc32Ieee(data) !== crc) {
      throw new RadioProtocolError(`Block ${hex(addr)} did not decode to the radio's checksum.`);
    }
    return data;
  }

  private async writeBlock(addr: number, data: Uint8Array, signal?: AbortSignal): Promise<void> {
    assertImageBlock(addr);
    if (data.length !== BLOCK_SIZE) {
      throw new RadioProtocolError(`Block ${hex(addr)} is not 4096 bytes.`);
    }
    const info = this.requireInfo();
    const blank = isBlank(data);
    const stream = blank ? new Uint8Array(0) : encodeBlock(data);
    const args = new Uint8Array(11);
    writeU32(args, 0, addr);
    args[4] = blank ? FMT_BLANK : FMT_LZ4;
    args[5] = stream.length & 0xff;
    args[6] = (stream.length >> 8) & 0xff;
    writeU32(args, 7, crc32Ieee(data));
    await this.request(OP_BLOCK, args, 4000);
    for (let off = 0; off < stream.length; off += info.dataChunk) {
      const piece = stream.subarray(off, Math.min(stream.length, off + info.dataChunk));
      const payload = new Uint8Array(2 + piece.length);
      payload[0] = off & 0xff;
      payload[1] = (off >> 8) & 0xff;
      payload.set(piece, 2);
      const body = await this.request(OP_DATA, payload, 4000);
      const received = body.length >= 2 ? body[0]! | (body[1]! << 8) : -1;
      if (received !== off + piece.length) {
        throw new RadioProtocolError(`Block ${hex(addr)} did not accept the stream.`);
      }
      if (signal?.aborted) throw new RadioProtocolError('Radio I/O operation was aborted.');
    }
    await this.request(OP_END, new Uint8Array(0), 8000);
  }

  private async request(op: number, args: Uint8Array, timeoutMs: number): Promise<Uint8Array> {
    const pipe = this.requirePipe();
    const payload = new Uint8Array(1 + args.length);
    payload[0] = op;
    payload.set(args, 1);
    if (payload.length > 64) {
      throw new RadioProtocolError('RadioFoundry codeplug request is longer than 64 bytes.');
    }
    let busy = 0;
    for (;;) {
      const seq = this.seq & 0xff;
      this.seq = (this.seq + 1) & 0xff;
      await pipe.write(encodeDebugFrame(CODEPLUG_COMMAND, seq, payload));
      let frame: DebugFrame;
      try {
        frame = await readFrame(pipe, timeoutMs);
      } catch (err) {
        if (op === OP_INFO) throw new RadioProtocolError(HANDSHAKE_ERROR);
        throw err;
      }
      if (frame.command !== REPLY_COMMAND || frame.seq !== seq || frame.payload.length < 1) {
        if (op === OP_INFO) throw new RadioProtocolError(HANDSHAKE_ERROR);
        throw new RadioProtocolError('Unexpected RadioFoundry codeplug reply.');
      }
      const status = frame.payload[0]!;
      if (status === 3 && busy < 4) {
        busy += 1;
        continue;
      }
      if (status !== 0) {
        if (op === OP_INFO || status === 1 || status === 4) {
          throw new RadioProtocolError(HANDSHAKE_ERROR);
        }
        const reason = status === 7 && frame.payload.length > 1 ? frame.payload[1] : undefined;
        throw new RadioProtocolError(
          reason == null
            ? `RadioFoundry codeplug command failed (status ${status}).`
            : `RadioFoundry codeplug command was refused (reason ${reason}).`,
        );
      }
      return frame.payload.subarray(1);
    }
  }

  private requireLink(): void {
    this.requirePipe();
    this.requireInfo();
  }

  private requirePipe(): BytePipe {
    if (!this.pipe) throw new RadioProtocolError(HANDSHAKE_ERROR);
    return this.pipe;
  }

  private requireInfo(): FastInfo {
    if (!this.info) throw new RadioProtocolError(HANDSHAKE_ERROR);
    return this.info;
  }

  private requireReadBlocks(): Map<number, Uint8Array> {
    if (!this.readBlocks) {
      throw new RadioProtocolError(
        'Read this radio in the current session before Write. RadioFoundry write will not start from a blank image.',
      );
    }
    return this.readBlocks;
  }

  private requireArmed(): Dm32RadioFoundryWriteSource {
    if (!this.armed) {
      throw new RadioProtocolError('RadioFoundry write needs the serialised codeplug image.');
    }
    return this.armed;
  }
}

export function createDm32uvRadioFoundryProtocol(): Dm32uvRadioFoundryProtocol {
  return new Dm32uvRadioFoundryProtocol();
}

function parseInfo(body: Uint8Array): FastInfo {
  if (body.length < 26 || body[0] !== 1) throw new RadioProtocolError(HANDSHAKE_ERROR);
  const block = body[2]! | (body[3]! << 8);
  const sumsMax = body[4]!;
  const dataMax = body[5]!;
  const readMax = body[6]! | (body[7]! << 8);
  if (block !== BLOCK_SIZE || sumsMax < 1 || dataMax < 1 || readMax < 1) {
    throw new RadioProtocolError(HANDSHAKE_ERROR);
  }
  const flashStart = readU32(body, 12);
  const imageEnd = readU32(body, 16);
  if (flashStart !== FLASH_IMAGE_START || imageEnd <= EEPROM_IMAGE_END) {
    throw new RadioProtocolError(HANDSHAKE_ERROR);
  }
  return {
    sumsMax: Math.min(sumsMax, 16),
    dataChunk: Math.min(dataMax, DATA_CHUNK_MAX),
    readMax: Math.min(readMax, 1000),
  };
}

function mergeBlock(
  radio: Uint8Array,
  addr: number,
  source: Dm32RadioFoundryWriteSource,
): Uint8Array {
  const want = radio.slice();
  const n = Math.min(BLOCK_SIZE, source.bytes.length - addr);
  for (let i = 0; i < n; i += 1) {
    if (source.owned[addr + i]) want[i] = source.bytes[addr + i]!;
  }
  return want;
}

function assertImageBlock(addr: number): void {
  if (!Number.isInteger(addr) || addr < 0 || addr >= PHYSICAL_CODEPLUG_BASE) {
    throw new RadioProtocolError(
      `Refusing wire address ${hex(addr)}. RadioFoundry codeplug writes use image offsets.`,
    );
  }
  if (addr % BLOCK_SIZE !== 0) {
    throw new RadioProtocolError(`Codeplug block ${hex(addr)} is not 4 KB aligned.`);
  }
  const inEeprom = addr + BLOCK_SIZE <= EEPROM_IMAGE_END;
  const inFlash = addr >= FLASH_IMAGE_START && addr < DM32_RADIOFOUNDRY_IMAGE_SIZE;
  if (!inEeprom && !inFlash) {
    throw new RadioProtocolError(`Codeplug block ${hex(addr)} is outside the image.`);
  }
}

function blankBlock(): Uint8Array {
  const block = new Uint8Array(BLOCK_SIZE);
  block.fill(0xff);
  return block;
}

function isBlank(block: Uint8Array): boolean {
  for (let i = 0; i < block.length; i += 1) if (block[i] !== 0xff) return false;
  return true;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

function writeU32(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function readU32(source: Uint8Array, offset: number): number {
  return (
    (source[offset]! |
      (source[offset + 1]! << 8) |
      (source[offset + 2]! << 16) |
      (source[offset + 3]! << 24)) >>>
    0
  );
}

function hex(addr: number): string {
  return `0x${(addr >>> 0).toString(16)}`;
}

async function readFrame(pipe: BytePipe, timeoutMs: number): Promise<DebugFrame> {
  const started = Date.now();
  const remaining = (): number => {
    const left = timeoutMs - (Date.now() - started);
    if (left <= 0) throw new RadioTimeoutError();
    return left;
  };
  let prev = 0;
  for (;;) {
    const b = (await pipe.readExact(1, remaining()))[0]!;
    if (prev === 0xa5 && b === 0x5a) break;
    prev = b;
  }
  const head = await pipe.readExact(4, remaining());
  const len = head[2]! | (head[3]! << 8);
  if (len > 1024) throw new RadioProtocolError('RadioFoundry codeplug reply is too long.');
  const rest = await pipe.readExact(len + 2, remaining());
  const frame = new Uint8Array(8 + len);
  frame[0] = 0xa5;
  frame[1] = 0x5a;
  frame.set(head, 2);
  frame.set(rest, 6);
  try {
    return decodeDebugFrame(frame);
  } catch {
    throw new RadioProtocolError('RadioFoundry codeplug reply CRC does not match.');
  }
}
