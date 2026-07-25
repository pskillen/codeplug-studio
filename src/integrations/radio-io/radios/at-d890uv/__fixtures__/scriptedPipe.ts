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

export class AtD890ScriptedPipe implements BytePipe {
  readonly writes: Uint8Array[] = [];
  private bytes: number[] = [];

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
      throw new Error(`AtD890ScriptedPipe: need ${n} bytes, have ${this.bytes.length}`);
    }
    return new Uint8Array(this.bytes.splice(0, n));
  }

  async close(): Promise<void> {
    /* no-op */
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

export { ANYTONE_DMR_BLOCK_SIZE };
