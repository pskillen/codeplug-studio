/**
 * Fake UV-5R Mini over a 64 KiB external flash, for the MM9PDY Write, Backup and Restore tests. Acks every W and
 * answers R from flash. A W to a 4 KiB-aligned address erases that sector first, as the radio's clone handler does.
 *
 * With `sessionDropMs` set it also models the clone session on `Date.now()` (use fake timers): the ident opens a
 * session, the radio ends it that long after the last byte it received, and outside a session it answers only an
 * ident and drops everything else without a reply. Inside a session a second ident gets no reply.
 */

import type { BytePipe } from '../../../types.ts';
import { PROGRAM_RW_ACK } from '../../../kit/codecs/programRw.ts';
import { RadioTimeoutError } from '../../../kit/errors.ts';
import { uv17ProCrypt } from '../../uv17pro-family/crypt.ts';
import { UV5R_MINI_LAYOUT as layout } from '../../uv17pro-family/layout.ts';
import { fakeMagicReply } from '../../uv17pro-family/magicReplyTestKit.ts';
import { MMZ1_BASE, MMZ1_END } from '../modData/index.ts';

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export class FakeMiniRadio implements BytePipe {
  readonly writes: Uint8Array[] = [];
  readonly flash = new Uint8Array(0x10000).fill(0xff);
  private buf = new Uint8Array(0);
  /** Stop acking (and storing) after this many W frames: an interrupted Write. */
  ackLimit = Infinity;
  /** Corrupt the stored copy of the frame at this address (verify must catch it). */
  corruptAt: number | undefined;
  /** Model the clone session: it ends this many ms after the last byte received. Unset: always in session. */
  sessionDropMs: number | undefined;
  private inSession = false;
  private lastRxAt = 0;

  constructor(private readonly modelPrefix: Uint8Array | undefined = layout.modelReplyPrefix) {}

  private enqueue(chunk: Uint8Array): void {
    const next = new Uint8Array(this.buf.length + chunk.length);
    next.set(this.buf);
    next.set(chunk, this.buf.length);
    this.buf = next;
  }

  async write(data: Uint8Array): Promise<void> {
    this.writes.push(data.slice());
    if (this.sessionDropMs !== undefined) {
      const now = Date.now();
      if (this.inSession && now - this.lastRxAt > this.sessionDropMs) this.inSession = false;
      this.lastRxAt = now;
      if (bytesEqual(data, layout.ident)) {
        if (this.inSession) return;
        this.inSession = true;
        return this.enqueue(new Uint8Array([PROGRAM_RW_ACK]));
      }
      if (!this.inSession) return;
    }
    if (bytesEqual(data, layout.ident)) return this.enqueue(new Uint8Array([PROGRAM_RW_ACK]));
    for (const m of [...layout.magics.read, ...layout.magics.upload]) {
      if (bytesEqual(data, m.send))
        return this.enqueue(fakeMagicReply(m.send, m.responseLen, this.modelPrefix));
    }
    const addr = (data[1]! << 8) | data[2]!;
    if (data[0] === 0x57) {
      if (this.wAddresses().length > this.ackLimit) return;
      const plain = uv17ProCrypt(data.subarray(4, 4 + layout.blockSize), layout.defaultEncrsym);
      if (addr % 0x1000 === 0) this.flash.fill(0xff, addr, addr + 0x1000);
      this.flash.set(plain, addr);
      if (addr === this.corruptAt) this.flash[addr + 5] ^= 0x01;
      this.enqueue(new Uint8Array([PROGRAM_RW_ACK]));
      return;
    }
    if (data[0] === 0x52) {
      const plain = this.flash.slice(addr, addr + layout.blockSize);
      const frame = new Uint8Array(4 + layout.blockSize);
      frame.set([0x52, (addr >> 8) & 0xff, addr & 0xff, layout.blockSize]);
      frame.set(uv17ProCrypt(plain, layout.defaultEncrsym), 4);
      this.enqueue(frame);
    }
  }

  async readExact(n: number): Promise<Uint8Array> {
    if (this.buf.length < n) {
      throw new RadioTimeoutError(`FakeMiniRadio: needed ${n}, have ${this.buf.length}`);
    }
    const out = this.buf.slice(0, n);
    this.buf = this.buf.slice(n);
    return out;
  }

  async flush(): Promise<void> {
    this.buf = new Uint8Array(0);
  }

  async close(): Promise<void> {
    /* no-op */
  }

  /** Every frame the radio was sent, as `ident`, `W`, `R` or `magic`, in order. */
  frameLog(): string[] {
    return this.writes.map((w) => {
      if (bytesEqual(w, layout.ident)) return 'ident';
      if (w[0] === 0x57) return 'W';
      if (w[0] === 0x52) return 'R';
      return 'magic';
    });
  }

  wAddresses(): number[] {
    return this.writes.filter((w) => w[0] === 0x57).map((w) => (w[1]! << 8) | w[2]!);
  }

  rAddresses(): number[] {
    return this.writes.filter((w) => w[0] === 0x52).map((w) => (w[1]! << 8) | w[2]!);
  }

  sector(): Uint8Array {
    return this.flash.slice(MMZ1_BASE, MMZ1_END);
  }
}
