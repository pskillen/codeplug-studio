/**
 * Scripted RadioFoundry radio for debug capture tests. Fictional payload bytes only.
 */
import { crc32Ieee } from '../../../kit/checksums.ts';
import { RadioTimeoutError } from '../../../kit/errors.ts';
import type { BytePipe } from '../../../types.ts';
import {
  BLOCK_SIZE,
  CODEPLUG_COMMAND,
  FMT_BLANK,
  FMT_LZ4,
  OP_INFO,
  OP_READ,
  OP_SUMS,
  PHYSICAL_CODEPLUG_BASE,
  servedBlockAddresses,
} from '../constants.ts';
import { decodeDebugFrame, encodeDebugFrame } from '../../../kit/codecs/radioFoundryDebugLink.ts';
import { decodeBlock, encodeBlock } from '../lz4.ts';
import { DMR_ID_DATABASE_AREA2_ADDRESS } from '../idDatabase.ts';

const REPLY = CODEPLUG_COMMAND | 0x80;
const IDDB = 0x1f;
const IDDB_REPLY = IDDB | 0x80;
const VERSION = 0x02;
const VERSION_REPLY = VERSION | 0x80;

export const DEFAULT_VERSION_TEXT =
  'proto=1\ngit=454a5b76\ngit_time=1795365604\nsource=official\nboard=DM-32UV\nfeatures=\n';

export interface FakeRadioFoundryOptions {
  fill?: number;
  imageEnd?: number;
  physicalBase?: number;
  versionText?: string | null;
  infoStatus?: number;
  sumsCrcOverride?: Map<number, number>;
}

function writeU32(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function u32(source: Uint8Array, offset: number): number {
  return (
    (source[offset]! |
      (source[offset + 1]! << 8) |
      (source[offset + 2]! << 16) |
      (source[offset + 3]! << 24)) >>>
    0
  );
}

function isBlank(block: Uint8Array): boolean {
  for (let i = 0; i < block.length; i += 1) if (block[i] !== 0xff) return false;
  return true;
}

export function makeFakeRadioFoundryInfoBody(
  imageEnd: number,
  flags = 0x02,
  physicalBase = PHYSICAL_CODEPLUG_BASE,
): Uint8Array {
  const body = new Uint8Array(26);
  body[0] = 1;
  body[1] = flags;
  body[2] = 0x00;
  body[3] = 0x10;
  body[4] = 16;
  body[5] = 61;
  body[6] = 1000 & 0xff;
  body[7] = (1000 >> 8) & 0xff;
  writeU32(body, 8, 0x10000);
  writeU32(body, 12, 0x20000);
  writeU32(body, 16, imageEnd);
  writeU32(body, 20, physicalBase);
  return body;
}

export class FakeRadioFoundryRadio implements BytePipe {
  readonly writes: Uint8Array[] = [];
  private pending = new Uint8Array(0);
  private blocks = new Map<number, Uint8Array>();
  infoStatus: number;
  versionText: string | null;
  versionStatus = 0;
  iddbStatus = 0;
  iddbBody = new Uint8Array([0, 0, 0, 0, 0, 0, 0]);
  silent = false;
  /** Answers the first frame with a single 0x2d byte (bad INFO evidence). */
  dash = false;
  dashUsed = false;
  closed = false;
  sumsCrcOverride: Map<number, number>;
  imageEnd: number;
  private readonly physicalBase: number;
  private readonly infoBody: Uint8Array;

  constructor(opts: FakeRadioFoundryOptions = {}) {
    const fill = opts.fill ?? 0xff;
    this.imageEnd = opts.imageEnd ?? 0x800000;
    this.physicalBase = opts.physicalBase ?? 0;
    this.infoStatus = opts.infoStatus ?? 0;
    this.versionText = opts.versionText === undefined ? DEFAULT_VERSION_TEXT : opts.versionText;
    this.sumsCrcOverride = opts.sumsCrcOverride ?? new Map();
    this.infoBody = makeFakeRadioFoundryInfoBody(this.imageEnd, 0x02, this.physicalBase);
    for (const addr of servedBlockAddresses()) {
      const block = new Uint8Array(BLOCK_SIZE);
      block.fill(fill);
      this.blocks.set(addr, block);
    }
  }

  setBlock(addr: number, bytes: Uint8Array): void {
    this.blocks.set(addr, bytes.slice());
  }

  block(addr: number): Uint8Array {
    const found = this.blocks.get(addr);
    if (found) return found;
    if (addr >= DMR_ID_DATABASE_AREA2_ADDRESS && addr + BLOCK_SIZE <= this.imageEnd) {
      const block = new Uint8Array(BLOCK_SIZE);
      block.fill(0xff);
      this.blocks.set(addr, block);
      return block;
    }
    throw new Error(`no block ${addr.toString(16)}`);
  }

  async write(data: Uint8Array): Promise<void> {
    const copy = data.slice();
    this.writes.push(copy);
    if (this.silent) return;
    if (this.dash && !this.dashUsed) {
      this.dashUsed = true;
      this.enqueue(new Uint8Array([0x2d]));
      return;
    }
    const request = decodeDebugFrame(copy);
    if (request.command === VERSION) {
      if (this.versionText === null) return;
      const text = this.versionStatus === 0 ? new TextEncoder().encode(this.versionText) : [];
      const payload = Uint8Array.from([this.versionStatus, ...text]);
      this.enqueue(encodeDebugFrame(VERSION_REPLY, request.seq, payload));
      return;
    }
    if (request.command === IDDB) {
      const payload = new Uint8Array(1 + this.iddbBody.length);
      payload[0] = this.iddbStatus;
      if (this.iddbStatus === 0) payload.set(this.iddbBody, 1);
      this.enqueue(encodeDebugFrame(IDDB_REPLY, request.seq, payload));
      return;
    }
    if (request.command === CODEPLUG_COMMAND && request.payload[0] === OP_INFO) {
      const payload = new Uint8Array(1 + (this.infoStatus === 0 ? this.infoBody.length : 0));
      payload[0] = this.infoStatus;
      if (this.infoStatus === 0) payload.set(this.infoBody, 1);
      this.enqueue(encodeDebugFrame(REPLY, request.seq, payload));
      return;
    }
    if (request.command !== CODEPLUG_COMMAND) throw new Error('unexpected request');
    const op = request.payload[0]!;
    const args = request.payload.subarray(1);
    let status = op === OP_INFO ? this.infoStatus : 0;
    let body: Uint8Array = new Uint8Array(0);
    if (status === 0) {
      if (op === OP_SUMS) body = this.sums(args);
      else if (op === OP_READ) body = this.read(args);
      else status = 2;
    }
    const payload = new Uint8Array(1 + body.length);
    payload[0] = status;
    if (status === 0) payload.set(body, 1);
    this.enqueue(encodeDebugFrame(REPLY, request.seq, payload));
  }

  async readExact(n: number): Promise<Uint8Array> {
    if (this.pending.length < n) throw new RadioTimeoutError();
    const out = this.pending.slice(0, n);
    this.pending = this.pending.slice(n);
    return out;
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  private enqueue(frame: Uint8Array): void {
    const next = new Uint8Array(this.pending.length + frame.length);
    next.set(this.pending, 0);
    next.set(frame, this.pending.length);
    this.pending = next;
  }

  private sums(args: Uint8Array): Uint8Array {
    const start = u32(args, 0);
    const count = args[4]!;
    const body = new Uint8Array(7 + count * 4);
    writeU32(body, 0, start);
    body[4] = count;
    let mask = 0;
    for (let j = 0; j < count; j += 1) {
      const addr = start + j * BLOCK_SIZE;
      const block = this.block(addr);
      if (isBlank(block)) mask |= 1 << j;
      const crc = this.sumsCrcOverride.get(addr) ?? crc32Ieee(block);
      writeU32(body, 7 + j * 4, crc);
    }
    body[5] = mask & 0xff;
    body[6] = (mask >> 8) & 0xff;
    return body;
  }

  private read(args: Uint8Array): Uint8Array {
    const addr = u32(args, 0);
    const offset = args[4]! | (args[5]! << 8);
    const block = this.block(addr);
    const blank = isBlank(block);
    const stream = blank ? new Uint8Array(0) : encodeBlock(block);
    const chunk = stream.subarray(offset, Math.min(stream.length, offset + 1000));
    const body = new Uint8Array(14 + chunk.length);
    writeU32(body, 0, addr);
    body[4] = blank ? FMT_BLANK : FMT_LZ4;
    body[5] = stream.length & 0xff;
    body[6] = (stream.length >> 8) & 0xff;
    writeU32(body, 7, crc32Ieee(block));
    body[11] = offset & 0xff;
    body[12] = (offset >> 8) & 0xff;
    body.set(chunk, 14);
    return body;
  }
}
