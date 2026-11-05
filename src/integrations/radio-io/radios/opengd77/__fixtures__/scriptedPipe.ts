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
import {
  OPENGD77_QUICKKEYS_END,
  OPENGD77_QUICKKEYS_START,
  OPENUV380_FLASH_SPANS,
} from '../constants.ts';
import { OPENGD77_FIRMWARE_INFO_SIZE } from '../protocol.ts';

function putU32Le(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >> 8) & 0xff;
  buf[offset + 2] = (value >> 16) & 0xff;
  buf[offset + 3] = (value >> 24) & 0xff;
}

export interface OpenGd77FirmwareInfoOptions {
  /** SPI flash part id; the 1701 and MD-9600 boot on 0x4018 only. */
  flashId?: number;
  features?: number;
}

export function makeOpenGd77FirmwareInfoPayload(
  radioType = 0x08,
  opts: OpenGd77FirmwareInfoOptions = {},
): Uint8Array {
  const payload = new Uint8Array(OPENGD77_FIRMWARE_INFO_SIZE);
  putU32Le(payload, 0, 3);
  putU32Le(payload, 4, radioType);
  const rev = new TextEncoder().encode('R20240101000000');
  payload.set(rev.subarray(0, 16), 8);
  const date = new TextEncoder().encode('20240101120000');
  payload.set(date.subarray(0, 16), 24);
  putU32Le(payload, 40, opts.flashId ?? 0x4018);
  payload[44] = (opts.features ?? 0) & 0xff;
  payload[45] = ((opts.features ?? 0) >> 8) & 0xff;
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

/**
 * `split`: the frame reached the radio as two USB packets. The first short packet is taken as a
 * whole frame (a SECTOR_BUFFER payload arrives as zeros), and the rest earns a busy `'-'` that
 * lands ahead of the real reply. `lose-data`: SECTOR_BUFFER is ACKed but its bytes never stage.
 * `nack`: one `'-'`. `nack-then-ack`: `'-'` then the ACK in one chunk. `wrong-echo`: two bytes that are not the ACK. `silent`: no reply. */
/**
 * A frame that straddles the host buffer boundary reaches the radio as two USB packets (A: the first `k`
 * bytes, B: the rest). Firmware rules modelled (`usbd_cdc_if.c` `CDC_Receive_FS`, `usb_com.c`):
 * - A short packet is a whole frame; the request buffer is zero-filled past it (so A is A padded with zeros).
 * - `busy`: B arrives while A is still pending, so the ISR answers `'-'` and A's own reply is lost to the busy
 *   IN endpoint. The host sees only `'-'`.
 * - not busy: A is handled and answered, then B is parsed from its first byte (`R`, `X`, `C` run as frames; any
 *   other byte earns `'-'`).
 * - `dropBReply`: (not busy only) B's reply is dropped because the host had not yet collected A's. The host
 *   then sees A's reply alone, which for a zero-filled SECTOR_BUFFER is a good ACK: the silent case.
 */
export interface SplitSpec {
  /** Cumulative host TX byte (0-based) at which the packet boundary falls; the frame holding it is split. */
  readonly txByte: number;
  readonly busy: boolean;
  readonly dropBReply?: boolean;
}

type WriteFault = 'nack' | 'nack-then-ack' | 'wrong-echo' | 'silent' | 'split' | 'lose-data';

/**
 * Firmware-faithful OpenGD77 radio (R20260130 `usb_com.c`): a NACK to a write command is ONE byte
 * `'-'`, an open sector (`sector`) NACKs the next SET_SECTOR, SECTOR_BUFFER / FINISH without an
 * open sector NACK, a NACK closes the sector, SHOW_CPS stacks (`cpsDepth`) and CLOSE_CPS pops one,
 * control 6 sub 0/1 reboot (clearing sector and CPS depth). SET_SECTOR loads the sector from flash
 * into a buffer, SECTOR_BUFFER fills the buffer (except the QuickKeys bytes, which it keeps), and
 * only FINISH programs it.
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
  private readonly faults: { cmd: number; nth: number; last: number; kind: WriteFault }[] = [];
  private staged = new Uint8Array(4096);
  private splitting = false;
  /** Cumulative bytes the host has written. */
  txBytes = 0;
  private splitSpec: SplitSpec | undefined;
  /** The straddling frame, once a {@link SplitSpec} fired: `[txByte offset of the frame, k]`. */
  splitFired: { frameStart: number; k: number; frame: Uint8Array } | undefined;
  private readonly seen = new Map<number, number>();
  /** `C` commands (by flag, 1-based nth) whose reply the radio withholds. */
  private readonly silentCommands: { flag: number; nth: number }[] = [];
  private readonly seenCommands = new Map<number, number>();

  constructor(
    private readonly radioType = 0x08,
    private readonly firmwareOpts: OpenGd77FirmwareInfoOptions = {},
  ) {
    for (const span of OPENUV380_FLASH_SPANS) {
      for (let i = 0; i < span.length; i++) {
        this.flash.set(span.start + i, 0xff);
      }
    }
  }

  /** Reads of FLASH starting at these addresses are refused. */
  readonly failReadsAt = new Set<number>();
  /** Reads of FLASH starting at these addresses get no reply at all (the host times out). */
  readonly silentReadsAt = new Set<number>();
  /** Reads of FLASH starting at these addresses come back with half the bytes asked for. */
  readonly shortReadsAt = new Set<number>();

  plantByte(abs: number, value: number): void {
    this.flash.set(abs, value & 0xff);
  }

  /**
   * The `nth` (1-based) write command `cmd` meets `kind` (default: the one-byte `'-'` NACK); with
   * `times` > 1 so do the following `times - 1` commands of that kind.
   */
  nackOn(cmd: number, nth = 1, kind: WriteFault = 'nack', times = 1): void {
    this.faults.push({ cmd, nth, last: nth + times - 1, kind });
  }

  /** The `nth` (1-based) `C` command with this flag is executed but never answered. */
  silenceCommand(flag: number, nth = 1): void {
    this.silentCommands.push({ flag, nth });
  }

  /** Arm a one-shot packet split at a cumulative TX byte; see {@link SplitSpec}. */
  splitAt(spec: SplitSpec): void {
    this.splitSpec = spec;
    this.splitFired = undefined;
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
    const start = this.txBytes;
    this.txBytes += data.length;
    const spec = this.splitSpec;
    if (spec && spec.txByte > start && spec.txByte < start + data.length) {
      this.splitSpec = undefined;
      await this.writeSplit(data, spec, spec.txByte - start, start);
      return;
    }
    this.splitting = false;
    const before = this.readBuf.length;
    await this.handle(data);
    if (this.splitting) {
      const next = new Uint8Array(this.readBuf.length + 1);
      next.set(this.readBuf.subarray(0, before));
      next[before] = OPENGD77_CMD_OK;
      next.set(this.readBuf.subarray(before), before + 1);
      this.readBuf = next;
    }
  }

  /** Run one packet through the firmware and return the replies it produced (not yet on the line). */
  private async packetReplies(packet: Uint8Array): Promise<Uint8Array> {
    const mark = this.readBuf.length;
    const kept = this.readBuf.slice(0, mark);
    this.readBuf = new Uint8Array(0);
    try {
      await this.handle(packet);
    } catch {
      // A frame the firmware cannot parse (e.g. `R` with its mem code cut off) is refused.
      this.enqueueChunks(new Uint8Array([OPENGD77_CMD_OK]));
    }
    const replies = this.readBuf;
    this.readBuf = kept;
    return replies;
  }

  private async writeSplit(
    frame: Uint8Array,
    spec: SplitSpec,
    k: number,
    frameStart: number,
  ): Promise<void> {
    this.splitFired = { frameStart, k, frame: frame.slice() };
    const a = new Uint8Array(frame.length);
    a.set(frame.subarray(0, k));
    const aReplies = await this.packetReplies(a);
    if (spec.busy) {
      this.enqueueChunks(new Uint8Array([OPENGD77_CMD_OK]));
      return;
    }
    this.enqueueChunks(aReplies);
    const b = frame.slice(k);
    const first = b[0];
    let bReplies: Uint8Array;
    if (
      first === OPENGD77_TYPE_READ ||
      first === OPENGD77_TYPE_COMMAND ||
      first === OPENGD77_TYPE_WRITE_UV380
    ) {
      const padded = new Uint8Array(Math.max(8, b.length));
      padded.set(b);
      bReplies = await this.packetReplies(padded);
    } else {
      bReplies = new Uint8Array([OPENGD77_CMD_OK]);
    }
    if (!spec.dropBReply) this.enqueueChunks(bReplies);
  }

  private async handle(data: Uint8Array): Promise<void> {
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
      const nth = (this.seenCommands.get(data[1]!) ?? 0) + 1;
      this.seenCommands.set(data[1]!, nth);
      const silentIdx = this.silentCommands.findIndex((f) => f.flag === data[1] && f.nth === nth);
      if (silentIdx >= 0) {
        this.silentCommands.splice(silentIdx, 1);
        return;
      }
      this.enqueueCmdAck();
      return;
    }
    if (data[0] === OPENGD77_TYPE_READ) {
      const mem = data[1]!;
      const addr = ((data[2]! << 24) | (data[3]! << 16) | (data[4]! << 8) | data[5]!) >>> 0;
      const length = ((data[6]! << 8) | data[7]!) >>> 0;
      if (mem === 0x09) {
        this.enqueueReadReply(makeOpenGd77FirmwareInfoPayload(this.radioType, this.firmwareOpts));
        return;
      }
      if (mem === 0x01) {
        if (this.failReadsAt.has(addr)) {
          // Refused read: three dashes so the host's header read completes and rejects.
          this.enqueueChunks(new Uint8Array([0x2d, 0x2d, 0x2d]));
          return;
        }
        if (this.silentReadsAt.has(addr)) return;
        const returned = this.shortReadsAt.has(addr) ? length >> 1 : length;
        const payload = new Uint8Array(returned);
        for (let i = 0; i < returned; i++) {
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
      const fault = this.faults.find((f) => f.cmd === cmd && nth >= f.nth && nth <= f.last);
      if (fault?.kind === 'split') this.splitting = true;
      const dropData = fault?.kind === 'lose-data';
      if (fault && fault.kind !== 'split' && fault.kind !== 'lose-data') {
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
        for (let i = 0; i < 4096; i++) {
          this.staged[i] = this.flash.get(this.openSector + i) ?? 0xff;
        }
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
        for (let i = 0; i < length && !dropData; i++) {
          const at = addr + i - this.openSector;
          const abs = addr + i;
          // Firmware hack: the QuickKeys are never overwritten by the codeplug.
          if (abs >= OPENGD77_QUICKKEYS_START && abs < OPENGD77_QUICKKEYS_END) continue;
          if (at >= 0 && at < 4096) this.staged[at] = this.splitting ? 0 : data[8 + i]!;
        }
        this.enqueueWriteAck(cmd);
        return;
      }
      if (cmd === OPENGD77_WRITE_CMD_FINISH_SECTOR) {
        if (this.openSector === -1) {
          this.enqueueChunks(new Uint8Array([OPENGD77_CMD_OK]));
          return;
        }
        for (let i = 0; i < 4096; i++) this.flash.set(this.openSector + i, this.staged[i]!);
        this.openSector = -1;
        this.enqueueWriteAck(cmd);
        return;
      }
      // Any other write command (including a bare `X` cut off after its type byte): refused, sector closed.
      this.openSector = -1;
      this.enqueueChunks(new Uint8Array([OPENGD77_CMD_OK]));
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
