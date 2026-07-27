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

export class AtD890ScriptedPipe implements BytePipe {
  readonly writes: Uint8Array[] = [];
  private bytes: number[] = [];

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
): void {
  for (let off = 0; off < data.length; off += ANYTONE_DMR_BLOCK_SIZE) {
    const chunk = data.subarray(off, off + ANYTONE_DMR_BLOCK_SIZE);
    pipe.enqueue(makeReadReply(address + off, chunk));
  }
}

export function scriptAtD890Connect(pipe: AtD890ScriptedPipe, version = 'V100'): void {
  pipe.enqueue(new Uint8Array([0x51]));
  pipe.enqueue(new Uint8Array([0x58, ANYTONE_DMR_ACK]));
  const ident = new TextEncoder().encode(`ID890UV\0${version}\0`);
  pipe.enqueue(ident);
  pipe.enqueue(new Uint8Array([ANYTONE_DMR_ACK]));
}

/** Minimal download: LocalInfo + empty ChannelSet + org bitmaps. */
export function scriptAtD890MinimalDownload(pipe: AtD890ScriptedPipe): void {
  scriptAtD890Connect(pipe);
  const local = new Uint8Array(D890_MAP.LocalInfoLength);
  local.fill(0xff);
  enqueueAtD890ReadReply(pipe, D890_MAP.LocalInfo, local);
  enqueueAtD890ReadReply(
    pipe,
    D890_MAP.OptionalSettingsMain,
    new Uint8Array(D890_MAP.OptionalSettingsMainLength).fill(0xff),
  );
  enqueueAtD890ReadReply(
    pipe,
    D890_MAP.OptionalSettingsExt,
    new Uint8Array(D890_MAP.OptionalSettingsExtLength).fill(0xff),
  );
  enqueueAtD890ReadReply(
    pipe,
    D890_MAP.OptionalSettingsAprs,
    new Uint8Array(D890_MAP.OptionalSettingsAprsLength).fill(0xff),
  );
  enqueueAtD890ReadReply(
    pipe,
    D890_MAP.AlarmBitmap,
    new Uint8Array(D890_MAP.AlarmBitmapLength).fill(0xff),
  );
  enqueueAtD890ReadReply(
    pipe,
    D890_MAP.AlarmData,
    new Uint8Array(D890_MAP.AlarmDataLength).fill(0xff),
  );
  const channelSet = new Uint8Array(0x200);
  enqueueAtD890ReadReply(pipe, D890_MAP.ChannelSet, channelSet);
  const zoneSet = new Uint8Array(0x20);
  enqueueAtD890ReadReply(pipe, D890_MAP.ZoneSet, zoneSet);
  enqueueAtD890ReadReply(pipe, D890_MAP.ZoneHide, zoneSet);
  enqueueAtD890ReadReply(pipe, D890_MAP.ZoneAChannel, new Uint8Array(0x200));
  enqueueAtD890ReadReply(pipe, D890_MAP.ZoneBChannel, new Uint8Array(0x200));
  enqueueAtD890ReadReply(pipe, D890_MAP.ScanListSet, new Uint8Array(0x20));
  enqueueAtD890ReadReply(pipe, D890_MAP.TalkgroupSet, new Uint8Array(0x4f0).fill(0xff));
  enqueueAtD890ReadReply(pipe, D890_MAP.ReceiveGroupSet, new Uint8Array(0x10));
  enqueueAtD890ReadReply(pipe, D890_MAP.RadioIdSet, new Uint8Array(0x20));
  enqueueAtD890ReadReply(pipe, D890_MAP.MasterIdData, new Uint8Array(0x40));
}

export function scriptAtD890WriteAck(pipe: AtD890ScriptedPipe, count: number): void {
  for (let i = 0; i < count; i++) {
    pipe.enqueue(new Uint8Array([ANYTONE_DMR_ACK]));
  }
}

/** Enqueue read replies for never-write sentinel spans (pre-Write plausibility). */
export function scriptAtD890SentinelReads(
  pipe: AtD890ScriptedPipe,
  overrides?: Partial<Record<string, Uint8Array>>,
): void {
  for (const extent of AT_D890_SENTINEL_EXTENTS) {
    const data = overrides?.[extent.id] ?? new Uint8Array(extent.length).fill(0xff);
    enqueueAtD890ReadReply(pipe, extent.start, data);
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
): void {
  scriptAtD890SentinelReads(pipe, { ...plausibleAtD890SentinelOverrides(), ...overrides });
}

export { ANYTONE_DMR_BLOCK_SIZE };
