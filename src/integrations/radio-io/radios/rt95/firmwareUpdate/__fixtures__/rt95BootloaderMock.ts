/**
 * Test-only RT95 head radio: a `BytePipe` port of `MockBootloader` in the firmware project's `tools/rt95update.py`,
 * plus the normal-mode PC link. A model of the frame rules, not of the real bootloader. Synthetic images only.
 *
 * Modes: `bootloader` (update mode), `normal` (the app's PC link: `PROGRAM` -> `QX 06`, `02` -> ident, `END` logged)
 * and `silent` (echo only). With `echo` on, every received byte comes back first, then the reply.
 * Faults (`nakAt`, `silentAt`, `corruptEchoAt`) are 1-based data-frame numbers; each fires once.
 */
import { RadioClosedError, RadioTimeoutError } from '../../../../kit/errors.ts';
import type { BytePipe } from '../../../../types.ts';

const PROGRAM = [0x50, 0x52, 0x4f, 0x47, 0x52, 0x41, 0x4d];
const CLONE_END = [0x45, 0x4e, 0x44];
const FRAME = 1032;
const BLOCK = 1024;

export interface Rt95BootloaderMockOptions {
  readonly mode?: 'bootloader' | 'normal' | 'silent';
  readonly echo?: boolean;
  readonly nakAt?: Iterable<number>;
  readonly silentAt?: Iterable<number>;
  readonly corruptEchoAt?: Iterable<number>;
  /** false: no reply to `18`. Default true. */
  readonly endReply?: boolean;
  /** Ignore this many `PROGRAM`s (echo only), for the pre-flight's retry after `END`. */
  readonly ignoreProgramFor?: number;
  /** Normal mode ident fields. */
  readonly model?: string;
  readonly version?: string;
  readonly band?: number;
}

const hex = (a: readonly number[]) => a.map((x) => x.toString(16).padStart(2, '0')).join('');

export class Rt95BootloaderMock implements BytePipe {
  readonly baudRate = 115_200;
  /** Human log: `PROGRAM`, `data 0x08002000`, `end`, `END`, `ident`, `badframe`, `unknown …`. */
  readonly log: string[] = [];
  /** Every byte the host wrote, in order (no echo bytes). */
  readonly received: number[] = [];
  readonly mem = new Map<number, Uint8Array>();
  frames = 0;
  ended = false;
  closed = false;

  private rx: number[] = [];
  private tx: number[] = [];
  /** Bytes that were already pending when the last write began: what a flush after that write may discard. */
  private stale = 0;
  private programsSeen = 0;
  private readonly mode: 'bootloader' | 'normal' | 'silent';
  private readonly echo: boolean;
  private readonly faults: { nak: Set<number>; silent: Set<number>; corruptEcho: Set<number> };
  private readonly endReply: boolean;
  private readonly ignoreProgramFor: number;
  private readonly model: string;
  private readonly version: string;
  private readonly band: number;

  constructor(opts: Rt95BootloaderMockOptions = {}) {
    this.mode = opts.mode ?? 'bootloader';
    this.echo = opts.echo ?? true;
    this.faults = {
      nak: new Set(opts.nakAt ?? []),
      silent: new Set(opts.silentAt ?? []),
      corruptEcho: new Set(opts.corruptEchoAt ?? []),
    };
    this.endReply = opts.endReply ?? true;
    this.ignoreProgramFor = opts.ignoreProgramFor ?? 0;
    this.model = opts.model ?? 'RT95-P';
    this.version = opts.version ?? 'V100';
    this.band = opts.band ?? 0x01;
  }

  async write(data: Uint8Array): Promise<void> {
    if (this.closed) throw new RadioClosedError();
    this.stale = this.tx.length;
    for (let i = 0; i < data.length; i++) {
      this.rx.push(data[i]!);
      this.received.push(data[i]!);
    }
    this.process();
  }

  /** Returns `n` bytes if buffered, otherwise a simulated timeout at once. */
  async readExact(n: number): Promise<Uint8Array> {
    if (this.closed) throw new RadioClosedError('Serial port closed unexpectedly.');
    if (this.tx.length < n) {
      throw new RadioTimeoutError(`Mock: needed ${n} bytes, have ${this.tx.length}.`);
    }
    return Uint8Array.from(this.tx.splice(0, n));
  }

  /** Discards stale input only. The codeplug codecs flush right after a write, before the reply is read. */
  async flush(): Promise<void> {
    this.tx.splice(0, Math.min(this.stale, this.tx.length));
    this.stale = 0;
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  /** Memory from `base` for `length` bytes: `FF`, overlaid with the stored blocks. */
  image(base: number, length: number): Uint8Array {
    const out = new Uint8Array(length).fill(0xff);
    for (const [a, d] of this.mem) {
      if (a >= base && a < base + length) {
        out.set(d.subarray(0, Math.min(BLOCK, base + length - a)), a - base);
      }
    }
    return out;
  }

  private startsWith(prefix: readonly number[]): boolean {
    if (this.rx.length < prefix.length) return false;
    for (let i = 0; i < prefix.length; i++) if (this.rx[i] !== prefix[i]) return false;
    return true;
  }

  private isPrefixOf(word: readonly number[]): boolean {
    if (this.rx.length >= word.length) return false;
    return this.rx.every((b, i) => b === word[i]);
  }

  /** Echo (when on) comes first, then the reply. */
  private respond(unit: readonly number[], reply: readonly number[]): void {
    if (this.echo) this.tx.push(...unit);
    if (this.mode !== 'silent') this.tx.push(...reply);
  }

  private process(): void {
    while (this.rx.length > 0) {
      const b = this.rx[0]!;
      if (this.startsWith(PROGRAM)) {
        const unit = this.rx.splice(0, PROGRAM.length);
        this.log.push('PROGRAM');
        this.programsSeen += 1;
        if (this.programsSeen <= this.ignoreProgramFor) this.respond(unit, []);
        else if (this.mode === 'normal') this.respond(unit, [0x51, 0x58, 0x06]);
        else this.respond(unit, [0x06]);
      } else if (this.startsWith(CLONE_END)) {
        const unit = this.rx.splice(0, CLONE_END.length);
        this.log.push('END');
        this.respond(unit, []);
      } else if (b === 0x02) {
        this.rx.shift();
        this.log.push('ident');
        if (this.mode === 'normal') {
          const ident = new Array<number>(15).fill(0);
          ident[0] = 0x49;
          const model = new TextEncoder().encode(this.model);
          for (let i = 0; i < 7 && i < model.length; i++) ident[1 + i] = model[i]!;
          ident[8] = this.band;
          const version = new TextEncoder().encode(this.version);
          for (let i = 0; i < 6 && i < version.length; i++) ident[9 + i] = version[i]!;
          this.respond([0x02], [...ident, 0x06]);
        } else {
          this.respond([0x02], []);
        }
      } else if (b === 0x18) {
        this.rx.shift();
        this.log.push('end');
        this.ended = true;
        this.respond([0x18], this.mode === 'bootloader' && this.endReply ? [0x06] : []);
      } else if (b === 0x01) {
        if (this.rx.length < FRAME) return;
        const f = Uint8Array.from(this.rx.splice(0, FRAME));
        this.frame(f);
      } else if (this.isPrefixOf(PROGRAM) || this.isPrefixOf(CLONE_END)) {
        return;
      } else {
        this.log.push(`unknown ${hex(this.rx.slice(0, 8))}`);
        this.rx = [];
      }
    }
  }

  private frame(f: Uint8Array): void {
    this.frames += 1;
    const n = this.frames;
    const echo = Array.from(f);
    if (this.faults.corruptEcho.delete(n)) echo[5] = echo[5]! ^ 0xff;
    let sum = 0;
    for (let i = 1; i < 0x405; i++) sum += f[i]!;
    const ok = (f[0x405]! | (f[0x406]! << 8)) === (sum & 0xffff) && f[0x407] === 0x06;
    if (this.echo) this.tx.push(...echo);
    if (this.mode !== 'bootloader') return;
    if (!ok) {
      this.log.push('badframe');
      this.tx.push(0x15);
      return;
    }
    const addr = (f[1]! | (f[2]! << 8) | (f[3]! << 16) | (f[4]! << 24)) >>> 0;
    if (this.faults.silent.delete(n)) return;
    if (this.faults.nak.delete(n)) {
      this.tx.push(0x15);
      return;
    }
    this.mem.set(addr, f.slice(5, 5 + BLOCK));
    this.log.push(`data 0x${addr.toString(16).padStart(8, '0')}`);
    this.tx.push(0x06);
  }
}
