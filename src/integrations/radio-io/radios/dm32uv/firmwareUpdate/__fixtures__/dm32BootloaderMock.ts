/**
 * Test-only DM-32UV update-mode bootloader: a `BytePipe` port of the firmware project's
 * `tools/flash/bootloader_mock.py`. A model of the CPS-visible behaviour, not of the real bootloader. It accepts the
 * byte stream the CPS sends, checks CRC16 and sequence numbers, and reassembles the body. Synthetic images only.
 */
import { RadioClosedError, RadioTimeoutError } from '../../../../kit/errors.ts';
import type { BytePipe } from '../../../../types.ts';

function crc16(data: Uint8Array): number {
  let crc = 0;
  for (const x of data) {
    crc ^= x << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc;
}

type MockState =
  | 'idle'
  | 'want4d'
  | 'want06'
  | 'want45'
  | 'want31'
  | 'wantsoh'
  | 'block0'
  | 'type'
  | 'data'
  | 'done';

const eq = (a: Uint8Array | null, b: readonly number[]) =>
  a !== null && a.length === b.length && b.every((x, i) => a[i] === x);
const hex = (a: Uint8Array | null) =>
  a ? Array.from(a, (x) => x.toString(16).padStart(2, '0')).join('') : '';

export interface Dm32BootloaderMockOptions {
  /** Ident the bootloader returns. Default `BFUV32-V2`. */
  readonly model?: string;
  /** Reply index (0-based) from which the radio goes silent. */
  readonly silentAt?: number;
  /** Replace the reply at a reply index. */
  readonly wrongReplyAt?: ReadonlyMap<number, Uint8Array>;
}

export class Dm32BootloaderMock implements BytePipe {
  readonly baudRate = 115_200;
  readonly violations: string[] = [];
  /** Every host write, in order. */
  readonly frames: Uint8Array[] = [];
  state: MockState = 'idle';
  erased = false;
  eotSeen = false;
  closed = false;
  meta = new Uint8Array(0);

  private rx: number[] = [];
  private tx: number[] = [];
  private bodyParts: Uint8Array[] = [];
  private expectSeq = 1;
  private pendingType = 0;
  private replies = 0;
  private readonly model: Uint8Array;
  private readonly silentAt?: number;
  private readonly wrongReplyAt: ReadonlyMap<number, Uint8Array>;

  constructor(opts: Dm32BootloaderMockOptions = {}) {
    this.model = new TextEncoder().encode(opts.model ?? 'BFUV32-V2');
    this.silentAt = opts.silentAt;
    this.wrongReplyAt = opts.wrongReplyAt ?? new Map();
  }

  get body(): Uint8Array {
    const out = new Uint8Array(this.bodyParts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of this.bodyParts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  }

  async write(data: Uint8Array): Promise<void> {
    if (this.closed) throw new RadioClosedError();
    this.frames.push(data.slice());
    this.tx.push(...data);
    this.process();
  }

  /** Returns `n` bytes if buffered, otherwise a simulated timeout at once. */
  async readExact(n: number): Promise<Uint8Array> {
    if (this.closed) throw new RadioClosedError();
    if (this.rx.length < n)
      throw new RadioTimeoutError(`Mock: needed ${n} bytes, have ${this.rx.length}.`);
    return Uint8Array.from(this.rx.splice(0, n));
  }

  async flush(): Promise<void> {
    this.rx = [];
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  private reply(bytes: Uint8Array | readonly number[]): void {
    const i = this.replies++;
    if (this.silentAt !== undefined && i >= this.silentAt) return;
    this.rx.push(...(this.wrongReplyAt.get(i) ?? bytes));
  }

  private take(n: number): Uint8Array | null {
    if (this.tx.length < n) return null;
    return Uint8Array.from(this.tx.splice(0, n));
  }

  private viol(m: string): void {
    this.violations.push(m);
  }

  private process(): void {
    while (this.tx.length > 0) {
      switch (this.state) {
        case 'idle': {
          const b = this.take(1);
          if (eq(b, [0x52])) {
            this.reply([0x06]);
            this.state = 'want4d';
          } else {
            this.viol(`idle got ${hex(b)}`);
            this.tx = [];
            return;
          }
          break;
        }
        case 'want4d': {
          const b = this.take(5);
          if (!b) return;
          if (!eq(b, [0x4d, 0, 0, 0, 1])) this.viol(`4D frame ${hex(b)}`);
          this.reply([0x4d, 0x01, this.model.length]);
          this.state = 'want06';
          break;
        }
        case 'want06': {
          const b = this.take(1);
          if (!eq(b, [0x06])) this.viol(`expected 06 got ${hex(b)}`);
          this.reply(this.model);
          this.state = 'want45';
          break;
        }
        case 'want45': {
          const b = this.take(5);
          if (!b) return;
          if (!eq(b, [0x45, 0, 0, 0, 0])) this.viol(`45 frame ${hex(b)}`);
          this.reply([0x06]);
          this.state = 'want31';
          break;
        }
        case 'want31': {
          const b = this.take(1);
          if (!eq(b, [0x31])) this.viol(`expected 31 got ${hex(b)}`);
          this.reply([0x43]);
          this.state = 'wantsoh';
          break;
        }
        case 'wantsoh': {
          const b = this.take(1);
          if (!eq(b, [0x01])) this.viol(`expected SOH got ${hex(b)}`);
          this.reply([0x43]);
          this.state = 'block0';
          break;
        }
        case 'block0': {
          const b = this.take(2 + 128 + 2);
          if (!b) return;
          if (b[0] !== 0x00 || b[1] !== 0xff) this.viol('block0 header');
          const payload = b.slice(2, 130);
          if (crc16(payload) !== ((b[130]! << 8) | b[131]!)) this.viol('block0 crc');
          let end = payload.length;
          while (end > 0 && payload[end - 1] === 0) end--;
          this.meta = payload.slice(0, end);
          this.erased = true;
          this.reply([0x06, 0x43]);
          this.state = 'type';
          break;
        }
        case 'type': {
          const b = this.take(1);
          if (eq(b, [0x04])) {
            this.eotSeen = true;
            this.reply([0x06]);
            this.state = 'done';
            return;
          }
          if (!eq(b, [0x01]) && !eq(b, [0x02])) this.viol(`type byte ${hex(b)}`);
          this.pendingType = b![0]!;
          this.reply([0x43]);
          this.state = 'data';
          break;
        }
        case 'data': {
          const size = this.pendingType === 2 ? 1024 : 128;
          const b = this.take(2 + size + 2);
          if (!b) return;
          const seq = this.expectSeq & 0xff;
          if (b[0] !== seq || b[1] !== 0xff - seq) {
            this.viol(`seq ${b[0]}/${b[1]}, wanted ${seq}`);
          }
          const payload = b.slice(2, 2 + size);
          if (crc16(payload) !== ((b[2 + size]! << 8) | b[3 + size]!)) {
            this.viol('block crc');
            return;
          }
          this.bodyParts.push(payload);
          this.expectSeq += 1;
          this.reply([0x06]);
          this.state = 'type';
          break;
        }
        case 'done': {
          this.viol(`bytes after done: ${hex(Uint8Array.from(this.tx.slice(0, 4)))}`);
          this.tx = [];
          return;
        }
      }
    }
  }
}
