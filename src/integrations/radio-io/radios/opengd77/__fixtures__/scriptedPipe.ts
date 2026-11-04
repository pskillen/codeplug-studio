/**
 * Scripted BytePipe for OpenGD77 connect / download / upload unit tests.
 */

import type { BytePipe } from '../../../types.ts';
import { RadioTimeoutError } from '../../../kit/errors.ts';
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

/** `nack`: one `'-'`. `nack-then-ack`: `'-'` then the ACK in one chunk. `wrong-echo`: two bytes that are not the ACK. `silent`: no reply. */
type WriteFault = 'nack' | 'nack-then-ack' | 'wrong-echo' | 'silent';

/**
 * Firmware-faithful OpenGD77 radio (R20260130 `usb_com.c`): a NACK to a write command is ONE byte
 * `'-'`, an open sector (`sector`) NACKs the next SET_SECTOR, SECTOR_BUFFER / FINISH without an
 * open sector NACK, a NACK closes the sector, SHOW_CPS stacks (`cpsDepth`) and CLOSE_CPS pops one,
 * control 6 sub 0/1 reboot (clearing sector and CPS depth).
 */
export class OpenGd77ScriptedPipe implements BytePipe {
  readonly writes: Uint8Array[] = [];
  /** `C` commands in order as `[flag, sub?]`. */
  readonly commands: number[][] = [];
  /** Control-6 sub-commands received (0 = save+reboot, 1 = reboot only, ...). */
  readonly controls: number[] = [];
  cpsDepth = 0;
  rebooted = false;
  /** Firmware `sector` state: -1 closed, otherwise the open sector's absolute address. */
  openSector = -1;
  private readBuf: Uint8Array = new Uint8Array(0);
  private flash = new Map<number, number>();
  private readonly faults: { cmd: number; nth: number; kind: WriteFault }[] = [];
  private readonly seen = new Map<number, number>();

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

  /** The `nth` (1-based) write command `cmd` is NACKed with the one-byte `'-'`. */
  nackOn(cmd: number, nth = 1, kind: WriteFault = 'nack'): void {
    this.faults.push({ cmd, nth, kind });
  }

  /** Put bytes on the line as if the radio had sent them unprompted. */
  injectStale(bytes: Uint8Array): void {
    this.enqueueChunks(bytes);
  }

  /** The `X` frames sent, filtered by command. */
  writesOf(cmd: number): Uint8Array[] {
    return this.writes.filter((w) => w[0] === OPENGD77_TYPE_WRITE_UV380 && w[1] === cmd);
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
      this.commands.push(Array.from(data.subarray(1, 3)));
      if (data[1] === 0x00) this.cpsDepth++;
      if (data[1] === 0x05) this.cpsDepth = Math.max(0, this.cpsDepth - 1);
      if (data[1] === 0x06) {
        this.controls.push(data[2]!);
        if (data[2] === 0x00 || data[2] === 0x01) {
          this.rebooted = true;
          this.cpsDepth = 0;
          this.openSector = -1;
        }
      }
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
      const nth = (this.seen.get(cmd) ?? 0) + 1;
      this.seen.set(cmd, nth);
      const faultIdx = this.faults.findIndex((f) => f.cmd === cmd && f.nth === nth);
      if (faultIdx >= 0) {
        const fault = this.faults.splice(faultIdx, 1)[0]!;
        if (fault.kind === 'silent') return;
        if (fault.kind === 'wrong-echo') {
          this.enqueueChunks(new Uint8Array([OPENGD77_TYPE_WRITE_UV380, 0x7f]));
          return;
        }
        this.openSector = -1;
        this.enqueueChunks(new Uint8Array([OPENGD77_CMD_OK]));
        if (fault.kind === 'nack-then-ack') this.enqueueWriteAck(cmd);
        return;
      }
      if (cmd === OPENGD77_WRITE_CMD_SET_SECTOR) {
        if (this.openSector !== -1) {
          this.openSector = -1;
          this.enqueueChunks(new Uint8Array([OPENGD77_CMD_OK]));
          return;
        }
        this.openSector = (((data[2]! << 16) | (data[3]! << 8) | data[4]!) >>> 0) * 4096;
        this.enqueueWriteAck(cmd);
        return;
      }
      if (cmd === OPENGD77_WRITE_CMD_SECTOR_BUFFER && this.openSector === -1) {
        this.enqueueChunks(new Uint8Array([OPENGD77_CMD_OK]));
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
        if (this.openSector === -1) {
          this.enqueueChunks(new Uint8Array([OPENGD77_CMD_OK]));
          return;
        }
        this.openSector = -1;
        this.enqueueWriteAck(cmd);
        return;
      }
    }
  }

  async readExact(n: number, timeoutMs: number): Promise<Uint8Array> {
    void timeoutMs;
    if (this.readBuf.length < n) {
      throw new RadioTimeoutError(
        `OpenGd77ScriptedPipe: needed ${n} bytes, have ${this.readBuf.length}`,
      );
    }
    const result = this.readBuf.slice(0, n);
    this.readBuf = this.readBuf.length > n ? this.readBuf.slice(n) : new Uint8Array(0);
    return result;
  }

  async flush(): Promise<void> {
    this.readBuf = new Uint8Array(0);
  }

  async drain(): Promise<Uint8Array> {
    const pending = this.readBuf;
    this.readBuf = new Uint8Array(0);
    return pending;
  }

  async close(): Promise<void> {
    /* no-op */
  }

  flashByte(abs: number): number | undefined {
    return this.flash.get(abs);
  }
}
