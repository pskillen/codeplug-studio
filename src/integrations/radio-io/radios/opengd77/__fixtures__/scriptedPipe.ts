/**
 * Scripted BytePipe for OpenGD77 connect / download / upload unit tests.
 */

import type { BytePipe } from '../../../types.ts';
import {
  OPENGD77_CMD_OK,
  OPENGD77_TYPE_COMMAND,
  OPENGD77_TYPE_READ,
  OPENGD77_TYPE_WRITE_UV380,
  OPENGD77_WRITE_CMD_FINISH_SECTOR,
  OPENGD77_WRITE_CMD_SECTOR_BUFFER,
  OPENGD77_WRITE_CMD_SET_SECTOR,
} from '../../../kit/codecs/opengd77Serial.ts';
import { OPENUV380_FLASH_SPANS } from '../constants.ts';
import { OPENGD77_FIRMWARE_INFO_SIZE } from '../protocol.ts';

function putU32Le(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >> 8) & 0xff;
  buf[offset + 2] = (value >> 16) & 0xff;
  buf[offset + 3] = (value >> 24) & 0xff;
}

export function makeOpenGd77FirmwareInfoPayload(radioType = 0x08): Uint8Array {
  const payload = new Uint8Array(OPENGD77_FIRMWARE_INFO_SIZE);
  putU32Le(payload, 0, 3);
  putU32Le(payload, 4, radioType);
  const rev = new TextEncoder().encode('R20240101000000');
  payload.set(rev.subarray(0, 16), 8);
  const date = new TextEncoder().encode('20240101120000');
  payload.set(date.subarray(0, 16), 24);
  return payload;
}

function enqueue(buf: Uint8Array, chunks: readonly Uint8Array[]): Uint8Array {
  let next = new Uint8Array(buf);
  for (const chunk of chunks) {
    const merged = new Uint8Array(next.length + chunk.length);
    merged.set(next);
    merged.set(chunk, next.length);
    next = merged;
  }
  return next;
}

export class OpenGd77ScriptedPipe implements BytePipe {
  readonly writes: Uint8Array[] = [];
  private readBuf: Uint8Array = new Uint8Array(0);
  private flash = new Map<number, number>();

  constructor(private readonly radioType = 0x08) {
    for (const span of OPENUV380_FLASH_SPANS) {
      for (let i = 0; i < span.length; i++) {
        this.flash.set(span.start + i, 0xff);
      }
    }
  }

  plantByte(abs: number, value: number): void {
    this.flash.set(abs, value & 0xff);
  }

  private enqueueChunks(...chunks: Uint8Array[]): void {
    this.readBuf = enqueue(this.readBuf, chunks);
  }

  private enqueueCmdAck(): void {
    this.enqueueChunks(new Uint8Array([OPENGD77_CMD_OK]));
  }

  private enqueueWriteAck(cmd: number): void {
    this.enqueueChunks(new Uint8Array([OPENGD77_TYPE_WRITE_UV380, cmd]));
  }

  private enqueueReadReply(payload: Uint8Array): void {
    const frame = new Uint8Array(3 + payload.length);
    frame[0] = OPENGD77_TYPE_READ;
    frame[1] = (payload.length >> 8) & 0xff;
    frame[2] = payload.length & 0xff;
    frame.set(payload, 3);
    this.enqueueChunks(frame);
  }

  async write(data: Uint8Array): Promise<void> {
    this.writes.push(data.slice());
    if (data[0] === OPENGD77_TYPE_COMMAND) {
      this.enqueueCmdAck();
      return;
    }
    if (data[0] === OPENGD77_TYPE_READ) {
      const mem = data[1]!;
      const addr = ((data[2]! << 24) | (data[3]! << 16) | (data[4]! << 8) | data[5]!) >>> 0;
      const length = ((data[6]! << 8) | data[7]!) >>> 0;
      if (mem === 0x09) {
        this.enqueueReadReply(makeOpenGd77FirmwareInfoPayload(this.radioType));
        return;
      }
      if (mem === 0x01) {
        const payload = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
          payload[i] = this.flash.get(addr + i) ?? 0xff;
        }
        this.enqueueReadReply(payload);
        return;
      }
      throw new Error(`Unexpected mem code 0x${mem.toString(16)}`);
    }
    if (data[0] === OPENGD77_TYPE_WRITE_UV380) {
      const cmd = data[1]!;
      if (cmd === OPENGD77_WRITE_CMD_SET_SECTOR) {
        this.enqueueWriteAck(cmd);
        return;
      }
      if (cmd === OPENGD77_WRITE_CMD_SECTOR_BUFFER) {
        const addr = ((data[2]! << 24) | (data[3]! << 16) | (data[4]! << 8) | data[5]!) >>> 0;
        const length = ((data[6]! << 8) | data[7]!) >>> 0;
        for (let i = 0; i < length; i++) {
          this.flash.set(addr + i, data[8 + i]!);
        }
        this.enqueueWriteAck(cmd);
        return;
      }
      if (cmd === OPENGD77_WRITE_CMD_FINISH_SECTOR) {
        this.enqueueWriteAck(cmd);
        return;
      }
    }
  }

  async readExact(n: number, timeoutMs: number): Promise<Uint8Array> {
    void timeoutMs;
    if (this.readBuf.length < n) {
      throw new Error(`OpenGd77ScriptedPipe: needed ${n} bytes, have ${this.readBuf.length}`);
    }
    const result = this.readBuf.slice(0, n);
    this.readBuf = this.readBuf.length > n ? this.readBuf.slice(n) : new Uint8Array(0);
    return result;
  }

  async flush(): Promise<void> {
    this.readBuf = new Uint8Array(0);
  }

  async close(): Promise<void> {
    /* no-op */
  }

  flashByte(abs: number): number | undefined {
    return this.flash.get(abs);
  }
}
