/**
 * Scripted BytePipe helpers for AT-D890UV unit tests.
 */

import type { BytePipe } from '../../../types.ts';
import {
  ANYTONE_DMR_ACK,
  ANYTONE_DMR_BLOCK_SIZE,
  anytoneDmrChecksum8AfterOpcode,
} from '../../../kit/codecs/anytoneDmrRw.ts';
import { D890_MAP } from '../constants.ts';
import { AT_D890_SENTINEL_EXTENTS } from '../writableExtents.ts';
import { AT_D890_ERASE_UNIT_BYTES } from '../eraseUnits.ts';
import { LOCAL_INFO_SERIAL_LENGTH, LOCAL_INFO_SERIAL_OFFSET } from '../identityCheck.ts';

export class AtD890ScriptedPipe implements BytePipe {
  readonly writes: Uint8Array[] = [];
  private bytes: number[] = [];
  /** When true, each `W` frame is ACKed with `0x06` automatically. */
  autoAckWrites = false;

  /**
   * When the byte queue is short, synthesize a read reply from the latest `R` frame.
   * Return `null` to simulate a silent radio (readExact will throw).
   */
  readResponder?: (address: number, length: number) => Uint8Array | null;

  enqueue(...chunks: Uint8Array[]): void {
    for (const chunk of chunks) {
      this.bytes.push(...chunk);
    }
  }

  async write(data: Uint8Array): Promise<void> {
    this.writes.push(data.slice());
    if (this.autoAckWrites && data[0] === 0x57) {
      this.bytes.push(0x06);
    }
  }

  async readExact(n: number, timeoutMs: number): Promise<Uint8Array> {
    void timeoutMs;
    if (this.bytes.length < n) {
      this.tryEnqueueReadReplyFromLastRequest();
    }
    if (this.bytes.length < n) {
      throw new Error(`AtD890ScriptedPipe: need ${n} bytes, have ${this.bytes.length}`);
    }
    return new Uint8Array(this.bytes.splice(0, n));
  }

  async flush(): Promise<void> {
    this.bytes = [];
  }

  async close(): Promise<void> {
    /* no-op */
  }

  private tryEnqueueReadReplyFromLastRequest(): void {
    const readFrames = this.writes.filter((w) => w[0] === 0x52);
    const last = readFrames.at(-1);
    if (!last || last.length < 6 || !this.readResponder) return;
    const addr = ((last[1]! << 24) | (last[2]! << 16) | (last[3]! << 8) | last[4]!) >>> 0;
    const len = last[5]!;
    const payload = this.readResponder(addr, len);
    if (!payload || payload.length !== len) return;
    this.enqueue(makeReadReply(addr, payload));
  }
}

function makeReadReply(addr: number, payload: Uint8Array): Uint8Array {
  const bodyLen = 6 + payload.length;
  const body = new Uint8Array(bodyLen);
  body[0] = 0x57;
  body[1] = (addr >>> 24) & 0xff;
  body[2] = (addr >>> 16) & 0xff;
  body[3] = (addr >>> 8) & 0xff;
  body[4] = addr & 0xff;
  body[5] = payload.length & 0xff;
  body.set(payload, 6);
  const checksum = anytoneDmrChecksum8AfterOpcode(body);
  const frame = new Uint8Array(bodyLen + 2);
  frame.set(body, 0);
  frame[bodyLen] = checksum;
  frame[bodyLen + 1] = ANYTONE_DMR_ACK;
  return frame;
}

export function enqueueAtD890ReadReply(
  pipe: AtD890ScriptedPipe,
  address: number,
  data: Uint8Array,
  readBlockSize = ANYTONE_DMR_BLOCK_SIZE,
): void {
  for (let off = 0; off < data.length; off += readBlockSize) {
    const chunkLen = Math.min(readBlockSize, data.length - off);
    const chunk = data.subarray(off, off + chunkLen);
    pipe.enqueue(makeReadReply(address + off, chunk));
  }
}

/** Enqueue a single read reply frame of `length` bytes at `address`. */
export function enqueueAtD890ReadReplyBlock(
  pipe: AtD890ScriptedPipe,
  address: number,
  payload: Uint8Array,
): void {
  pipe.enqueue(makeReadReply(address, payload));
}

/**
 * Prepare readResponder for connect-time block negotiation at `address`.
 * Call before {@link scriptAtD890Connect} so `connect()` can probe block sizes.
 */
export function scriptAtD890NegotiateReadBlock(
  pipe: AtD890ScriptedPipe,
  address: number,
  maxBlock: number,
  spanLength = 0x100,
): void {
  const data = new Uint8Array(spanLength).fill(0xff);
  pipe.readResponder = (addr, len) => {
    const off = addr - address;
    if (off < 0 || off + len > spanLength) return null;
    if (len > maxBlock) return null;
    return data.subarray(off, off + len);
  };
}

export function scriptAtD890ConnectWithNegotiation(
  pipe: AtD890ScriptedPipe,
  maxBlock = 0xf0,
): void {
  scriptAtD890NegotiateReadBlock(pipe, D890_MAP.LocalInfo, maxBlock);
  scriptAtD890Connect(pipe);
}

export function scriptAtD890Connect(pipe: AtD890ScriptedPipe, version = 'V100'): void {
  pipe.enqueue(new Uint8Array([0x51]));
  pipe.enqueue(new Uint8Array([0x58, ANYTONE_DMR_ACK]));
  const ident = new TextEncoder().encode(`ID890UV\0${version}\0`);
  pipe.enqueue(ident);
  pipe.enqueue(new Uint8Array([ANYTONE_DMR_ACK]));
}

const NEGOTIATED_READ_BLOCK = 0xf0;

function minimalDownloadMemory(): Map<number, Uint8Array> {
  return new Map([
    [D890_MAP.LocalInfo, new Uint8Array(D890_MAP.LocalInfoLength).fill(0xff)],
    [D890_MAP.OptionalSettingsMain, new Uint8Array(D890_MAP.OptionalSettingsMainLength).fill(0xff)],
    [D890_MAP.OptionalSettingsExt, new Uint8Array(D890_MAP.OptionalSettingsExtLength).fill(0xff)],
    [D890_MAP.OptionalSettingsAprs, new Uint8Array(D890_MAP.OptionalSettingsAprsLength).fill(0xff)],
    [D890_MAP.AlarmBitmap, new Uint8Array(D890_MAP.AlarmBitmapLength).fill(0xff)],
    [D890_MAP.AlarmData, new Uint8Array(D890_MAP.AlarmDataLength).fill(0xff)],
    [D890_MAP.ChannelSet, new Uint8Array(0x200)],
    [D890_MAP.ZoneSet, new Uint8Array(0x20)],
    [D890_MAP.ZoneHide, new Uint8Array(0x20)],
    [D890_MAP.ZoneAChannel, new Uint8Array(0x200)],
    [D890_MAP.ZoneBChannel, new Uint8Array(0x200)],
    [D890_MAP.ScanListSet, new Uint8Array(0x20)],
    [D890_MAP.TalkgroupSet, new Uint8Array(0x4f0).fill(0xff)],
    [D890_MAP.ReceiveGroupSet, new Uint8Array(0x10)],
    [D890_MAP.RadioIdSet, new Uint8Array(0x20)],
    [D890_MAP.MasterIdData, new Uint8Array(0x40)],
  ]);
}

function scriptAtD890MemoryReadResponder(
  pipe: AtD890ScriptedPipe,
  memory: Map<number, Uint8Array>,
  maxBlock = NEGOTIATED_READ_BLOCK,
): void {
  pipe.readResponder = (addr, len) => {
    if (addr === D890_MAP.LocalInfo && len > maxBlock) return null;
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      const absolute = addr + i;
      let byte = 0xff;
      for (const [start, data] of memory) {
        if (absolute >= start && absolute < start + data.length) {
          byte = data[absolute - start]!;
          break;
        }
      }
      out[i] = byte;
    }
    return out;
  };
}

/** Minimal download: negotiate + connect + empty org bitmaps via readResponder. */
export function scriptAtD890MinimalDownload(pipe: AtD890ScriptedPipe): void {
  scriptAtD890MemoryReadResponder(pipe, minimalDownloadMemory());
  scriptAtD890Connect(pipe);
}

export function scriptAtD890WriteAck(pipe: AtD890ScriptedPipe, count: number): void {
  for (let i = 0; i < count; i++) {
    pipe.enqueue(new Uint8Array([ANYTONE_DMR_ACK]));
  }
}

/** ACK each write frame as it is sent — safe to use before upload reads complete. */
export function enableAtD890AutoWriteAck(pipe: AtD890ScriptedPipe): void {
  pipe.autoAckWrites = true;
}

/** Enqueue read replies for never-write sentinel spans (pre-Write plausibility). */
export function scriptAtD890SentinelReads(
  pipe: AtD890ScriptedPipe,
  overrides?: Partial<Record<string, Uint8Array>>,
  readBlockSize = ANYTONE_DMR_BLOCK_SIZE,
): void {
  for (const extent of AT_D890_SENTINEL_EXTENTS) {
    const data = overrides?.[extent.id] ?? new Uint8Array(extent.length).fill(0xff);
    enqueueAtD890ReadReply(pipe, extent.start, data, readBlockSize);
  }
}

/** Sentinel reads with at least one non-0xff byte per region — passes pre-Write plausibility. */
export function plausibleAtD890SentinelOverrides(): Partial<Record<string, Uint8Array>> {
  const overrides: Partial<Record<string, Uint8Array>> = {};
  for (const extent of AT_D890_SENTINEL_EXTENTS) {
    const data = new Uint8Array(extent.length).fill(0xff);
    data[0] = 0x00;
    overrides[extent.id] = data;
  }
  return overrides;
}

export function scriptAtD890PlausibleSentinelReads(
  pipe: AtD890ScriptedPipe,
  overrides?: Partial<Record<string, Uint8Array>>,
  readBlockSize = ANYTONE_DMR_BLOCK_SIZE,
): void {
  scriptAtD890SentinelReads(
    pipe,
    { ...plausibleAtD890SentinelOverrides(), ...overrides },
    readBlockSize,
  );
}

/** LocalInfo with a known serial for identity-check tests. */
export function localInfoWithSerial(serial: string): Uint8Array {
  const out = new Uint8Array(D890_MAP.LocalInfoLength).fill(0xff);
  const bytes = new TextEncoder().encode(serial);
  out.set(bytes.subarray(0, LOCAL_INFO_SERIAL_LENGTH), LOCAL_INFO_SERIAL_OFFSET);
  out[0] = 0x00;
  return out;
}

/** Fresh-read buffer for one erase unit (`0x40000` bytes). */
export function makeAtD890EraseUnitBuffer(fill = 0xff): Uint8Array {
  return new Uint8Array(AT_D890_ERASE_UNIT_BYTES).fill(fill);
}

/** Ensure sentinel snapshot spans are readable with at least one non-`0xff` byte each. */
export function withAtD890PlausibleSentinelSpans(
  memory: Map<number, Uint8Array>,
): Map<number, Uint8Array> {
  const out = new Map(memory);
  for (const extent of AT_D890_SENTINEL_EXTENTS) {
    const covered = [...out.entries()].some(
      ([start, data]) =>
        extent.start >= start && extent.start + extent.length <= start + data.length,
    );
    if (!covered) {
      const data = new Uint8Array(extent.length).fill(0xff);
      data[0] = 0x00;
      out.set(extent.start, data);
    }
  }
  return out;
}

/** `readResponder` backing store for sparse-RMW upload tests (sentinels + erase units). */
export function scriptAtD890UploadReadResponder(
  pipe: AtD890ScriptedPipe,
  memory: Map<number, Uint8Array>,
  maxBlock = NEGOTIATED_READ_BLOCK,
): void {
  scriptAtD890MemoryReadResponder(pipe, withAtD890PlausibleSentinelSpans(memory), maxBlock);
}

export function collectAtD890ReadRequestAddresses(pipe: AtD890ScriptedPipe): number[] {
  return pipe.writes
    .filter((w) => w[0] === 0x52)
    .map((w) => ((w[1]! << 24) | (w[2]! << 16) | (w[3]! << 8) | w[4]!) >>> 0);
}

export function collectAtD890WriteDataAddresses(pipe: AtD890ScriptedPipe): number[] {
  return pipe.writes
    .filter((w) => w[0] === 0x57)
    .map((w) => ((w[1]! << 24) | (w[2]! << 16) | (w[3]! << 8) | w[4]!) >>> 0);
}

export function indexOfFirstAtD890WriteFrame(pipe: AtD890ScriptedPipe): number {
  return pipe.writes.findIndex((w) => w[0] === 0x57);
}

/** Payload bytes from the first write frame targeting `address`. */
export function writePayloadAt(pipe: AtD890ScriptedPipe, address: number): Uint8Array | undefined {
  const frame = pipe.writes.find(
    (w) =>
      w[0] === 0x57 && ((w[1]! << 24) | (w[2]! << 16) | (w[3]! << 8) | w[4]!) >>> 0 === address,
  );
  if (!frame || frame.length < 22) return undefined;
  return frame.subarray(6, 22);
}

export { ANYTONE_DMR_BLOCK_SIZE };
