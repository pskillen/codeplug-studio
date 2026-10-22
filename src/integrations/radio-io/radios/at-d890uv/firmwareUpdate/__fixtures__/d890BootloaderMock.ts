/**
 * Test-only AT-D890UV update-mode bootloader: a `BytePipe` port of `MockBootloader` in the firmware project's
 * `tools/d890update.py`, firmware mode only. A model of the frame rules, not of the real bootloader.
 * Faults (`nakAt`, `corruptReplyAt`, `silentAt`) are 1-based frame numbers; each fires once. Synthetic images only.
 */
import { RadioClosedError, RadioTimeoutError } from '../../../../kit/errors.ts';
import type { BytePipe } from '../../../../types.ts';

const UPDATE = [0x55, 0x50, 0x44, 0x41, 0x54, 0x45];
const FRAME = 40;
const BLOCK = 32;

export interface D890BootloaderMockOptions {
  readonly model?: string;
  readonly version?: string;
  /** ident[8]: `00` in the bootloader, `03` in normal (app) mode. */
  readonly bandByte?: number;
  readonly nakAt?: Iterable<number>;
  readonly corruptReplyAt?: Iterable<number>;
  readonly silentAt?: Iterable<number>;
  /** The real bootloader restarts after `18` and its USB port disappears. */
  readonly dropAfterEnd?: boolean;
  /** Close the port after this many frames (1-based), before replying to it. */
  readonly closeAtFrame?: number;
}

const hex = (a: readonly number[]) => a.map((x) => x.toString(16).padStart(2, '0')).join('');

export class D890BootloaderMock implements BytePipe {
  readonly baudRate = 921_600;
  readonly log: string[] = [];
  readonly mem = new Map<number, Uint8Array>();
  frames = 0;
  ended = false;
  closed = false;

  private rx: number[] = [];
  private tx: number[] = [];
  private readonly model: string;
  private readonly version: string;
  private readonly bandByte: number;
  private readonly faults: { nak: Set<number>; corrupt: Set<number>; silent: Set<number> };
  private readonly dropAfterEnd: boolean;
  private readonly closeAtFrame?: number;

  constructor(opts: D890BootloaderMockOptions = {}) {
    this.model = opts.model ?? 'D890UV';
    this.version = opts.version ?? 'V100';
    this.bandByte = opts.bandByte ?? 0x00;
    this.faults = {
      nak: new Set(opts.nakAt ?? []),
      corrupt: new Set(opts.corruptReplyAt ?? []),
      silent: new Set(opts.silentAt ?? []),
    };
    this.dropAfterEnd = opts.dropAfterEnd ?? false;
    this.closeAtFrame = opts.closeAtFrame;
  }

  async write(data: Uint8Array): Promise<void> {
    if (this.closed) throw new RadioClosedError();
    for (let i = 0; i < data.length; i++) this.rx.push(data[i]!);
    this.process();
  }

  /** Returns `n` bytes if buffered, otherwise a simulated timeout at once. */
  async readExact(n: number): Promise<Uint8Array> {
    if (this.closed) throw new RadioClosedError('Serial port closed unexpectedly.');
    if (this.ended && this.dropAfterEnd && this.tx.length === 0) {
      this.closed = true;
      throw new RadioClosedError('Serial port closed unexpectedly.');
    }
    if (this.tx.length < n) {
      throw new RadioTimeoutError(`Mock: needed ${n} bytes, have ${this.tx.length}.`);
    }
    return Uint8Array.from(this.tx.splice(0, n));
  }

  async flush(): Promise<void> {
    this.tx = [];
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

  /** True while `rx` could still become `UPDATE`. */
  private isUpdatePrefix(): boolean {
    if (this.rx.length >= UPDATE.length) return false;
    return this.rx.every((b, i) => b === UPDATE[i]);
  }

  private process(): void {
    while (this.rx.length > 0) {
      const b = this.rx[0]!;
      if (this.startsWith(UPDATE)) {
        this.rx.splice(0, UPDATE.length);
        this.log.push('UPDATE');
        this.tx.push(0x06);
      } else if (b === 0x02) {
        this.rx.shift();
        this.log.push('ident');
        const model = new TextEncoder().encode(this.model);
        const ident = new Array<number>(16).fill(0);
        ident[0] = 0x49;
        for (let i = 0; i < 7 && i < model.length; i++) ident[1 + i] = model[i]!;
        ident[8] = this.bandByte;
        const version = new TextEncoder().encode(this.version);
        for (let i = 0; i < 4; i++) ident[9 + i] = version[i] ?? 0;
        ident[15] = 0x06;
        this.tx.push(...ident);
      } else if (b === 0x18) {
        this.rx.shift();
        this.log.push('end');
        this.ended = true;
        if (!this.dropAfterEnd) this.tx.push(0x06);
      } else if (b === 0x01) {
        if (this.rx.length < FRAME) return;
        const f = Uint8Array.from(this.rx.splice(0, FRAME));
        this.frame(f);
      } else if (this.isUpdatePrefix()) {
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
    let sum = 0;
    for (let i = 1; i < 37; i++) sum += f[i]!;
    const ok = (f[37]! | (f[38]! << 8)) === (sum & 0xffff) && f[39] === 0x06;
    if (!ok) {
      this.log.push('badframe');
      this.tx.push(0x15);
      return;
    }
    if (this.closeAtFrame !== undefined && n >= this.closeAtFrame) {
      this.closed = true;
      return;
    }
    const addr = (f[1]! | (f[2]! << 8) | (f[3]! << 16) | (f[4]! << 24)) >>> 0;
    if (this.faults.silent.delete(n)) return;
    if (this.faults.nak.delete(n)) {
      this.tx.push(0x15);
      return;
    }
    this.mem.set(addr, f.slice(5, 37));
    this.log.push(`data 0x${addr.toString(16).padStart(8, '0')}`);
    this.tx.push(this.faults.corrupt.delete(n) ? 0x07 : 0x06);
  }
}
