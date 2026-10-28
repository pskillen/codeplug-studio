/**
 * Frame-level fake of an RT95 on a shared TX/RX cable (tests only, never a real port).
 *
 * Echoes every byte written, then answers PROGRAM / ident / R / W frames from a small EEPROM
 * model. After END the radio is deaf for `deafAfterEndMs` (it reloads from the main board):
 * PROGRAM, R and W get the echo and nothing else.
 */

import type { BytePipe } from '../../../types.ts';
import { RadioClosedError, RadioTimeoutError } from '../../../kit/errors.ts';
import { programQxChecksum8AfterOpcode } from '../../../kit/codecs/programQx.ts';
import { buildSyntheticRt95Image } from './syntheticImage.ts';

export const FAKE_RT95_EEPROM_SIZE = 0x8000;
export const FAKE_RT95_IDENT_ADDR = 0x3b00;

export type FakeRt95Op = 'PROGRAM' | 'IDENT' | 'R' | 'W' | 'END';

export interface FakeRt95LogEntry {
  op: FakeRt95Op;
  addr?: number;
}

export interface FakeRt95PipeOptions {
  /** 32 KiB EEPROM model. Default: 0xFF, synthetic image at 0x0000, ident record at 0x3B00. */
  eeprom?: Uint8Array;
  /** While deaf after END, PROGRAM, R and W are echoed and not answered. Default 0. */
  deafAfterEndMs?: number;
  /** Clock for the deaf window (default Date.now). */
  now?: () => number;
}

export interface FakeRt95Pipe extends BytePipe {
  readonly eeprom: Uint8Array;
  readonly log: FakeRt95LogEntry[];
  /** Clock reading when the last END arrived, or null. */
  readonly lastEndAt: number | null;
  /** Every frame written by the host, in order. */
  readonly writes: Uint8Array[];
  count(op: FakeRt95Op): number;
  flush(): Promise<void>;
}

const ENC = new TextEncoder();
const PROGRAM = ENC.encode('PROGRAM');
const END = ENC.encode('END');

/** Ident reply the stock parser accepts: 0x49, "RT95-P", bandlimit 0x01, "V100", 0x06. */
export function fakeRt95IdentReply(): Uint8Array {
  const out = new Uint8Array(16);
  out[0] = 0x49;
  out.set(ENC.encode('RT95-P'), 1);
  out[8] = 0x01;
  out.set(ENC.encode('V100'), 9);
  out[15] = 0x06;
  return out;
}

export function buildFakeRt95Eeprom(): Uint8Array {
  const eeprom = new Uint8Array(FAKE_RT95_EEPROM_SIZE).fill(0xff);
  eeprom.set(buildSyntheticRt95Image(), 0);
  eeprom.fill(0x00, FAKE_RT95_IDENT_ADDR, FAKE_RT95_IDENT_ADDR + 16);
  eeprom.set(ENC.encode('RT95-P'), FAKE_RT95_IDENT_ADDR);
  eeprom.set(ENC.encode('V100'), FAKE_RT95_IDENT_ADDR + 7);
  return eeprom;
}

function readReply(addr: number, payload: Uint8Array): Uint8Array {
  const body = new Uint8Array(4 + payload.length);
  body[0] = 0x52;
  body[1] = (addr >>> 8) & 0xff;
  body[2] = addr & 0xff;
  body[3] = payload.length;
  body.set(payload, 4);
  const frame = new Uint8Array(body.length + 2);
  frame.set(body, 0);
  frame[body.length] = programQxChecksum8AfterOpcode(body);
  frame[body.length + 1] = 0x06;
  return frame;
}

function startsWith(buf: number[], prefix: Uint8Array): boolean {
  if (buf.length < prefix.length) return false;
  return prefix.every((b, i) => buf[i] === b);
}

export function createFakeRt95Pipe(options: FakeRt95PipeOptions = {}): FakeRt95Pipe {
  const eeprom = options.eeprom ?? buildFakeRt95Eeprom();
  const deafAfterEndMs = options.deafAfterEndMs ?? 0;
  const now = options.now ?? Date.now;
  const log: FakeRt95LogEntry[] = [];
  const writes: Uint8Array[] = [];
  const rx: number[] = [];
  let pending: number[] = [];
  let lastEndAt: number | null = null;
  let closed = false;
  const waiters: (() => void)[] = [];
  const defer =
    typeof setImmediate === 'function' ? setImmediate : (fn: () => void) => setTimeout(fn, 0);

  const isDeaf = (): boolean => lastEndAt !== null && now() - lastEndAt < deafAfterEndMs;
  // Bytes reach the host on a later tick, so a flush issued right after a write (as the
  // kit does) cannot swallow the reply; a flush before the next command drops stale bytes.
  const push = (bytes: Uint8Array): void => {
    const copy = bytes.slice();
    defer(() => {
      for (const b of copy) rx.push(b);
      const ready = waiters.splice(0);
      for (const wake of ready) wake();
    });
  };

  /** Consume complete frames from `pending`; stop at a partial frame. */
  function process(): void {
    for (;;) {
      if (pending.length === 0) return;
      const first = pending[0]!;
      if (first === 0x50) {
        if (pending.length < PROGRAM.length) return;
        if (!startsWith(pending, PROGRAM)) {
          pending.shift();
          continue;
        }
        pending = pending.slice(PROGRAM.length);
        if (isDeaf()) continue;
        log.push({ op: 'PROGRAM' });
        push(new Uint8Array([0x51, 0x58, 0x06]));
      } else if (first === 0x45) {
        if (pending.length < END.length) return;
        if (!startsWith(pending, END)) {
          pending.shift();
          continue;
        }
        pending = pending.slice(END.length);
        lastEndAt = now();
        log.push({ op: 'END' });
      } else if (first === 0x02) {
        pending.shift();
        if (isDeaf()) continue;
        log.push({ op: 'IDENT' });
        push(fakeRt95IdentReply());
      } else if (first === 0x52) {
        if (pending.length < 4) return;
        const addr = (pending[1]! << 8) | pending[2]!;
        const len = pending[3]!;
        pending = pending.slice(4);
        if (isDeaf()) continue;
        log.push({ op: 'R', addr });
        push(readReply(addr, eeprom.slice(addr, addr + len)));
      } else if (first === 0x57) {
        if (pending.length < 4) return;
        const len = pending[3]!;
        const total = 4 + len + 2;
        if (pending.length < total) return;
        const addr = (pending[1]! << 8) | pending[2]!;
        const payload = Uint8Array.from(pending.slice(4, 4 + len));
        pending = pending.slice(total);
        if (isDeaf()) continue;
        log.push({ op: 'W', addr });
        if (addr + len <= eeprom.length) eeprom.set(payload, addr);
        push(new Uint8Array([0x06]));
      } else {
        pending.shift();
      }
    }
  }

  return {
    eeprom,
    log,
    writes,
    get lastEndAt() {
      return lastEndAt;
    },
    count: (op) => log.filter((e) => e.op === op).length,
    async write(data) {
      if (closed) throw new RadioClosedError();
      writes.push(data.slice());
      push(data); // shared TX/RX cable: everything written comes back
      for (const b of data) pending.push(b);
      process();
    },
    async readExact(n, timeoutMs) {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        if (rx.length >= n) return Uint8Array.from(rx.splice(0, n));
        if (closed) throw new RadioClosedError();
        if (Date.now() >= deadline) {
          throw new RadioTimeoutError('fakeRt95Pipe: timed out');
        }
        let timer: ReturnType<typeof setTimeout> | undefined;
        await new Promise<void>((resolve) => {
          waiters.push(resolve);
          timer = setTimeout(resolve, Math.max(1, deadline - Date.now()));
        });
        clearTimeout(timer);
      }
    },
    async flush() {
      // Like the Web Serial pipe: drop unread input (stale echo).
      rx.length = 0;
    },
    async close() {
      closed = true;
    },
  };
}
