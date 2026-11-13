/**
 * The UV-5R Mini debug read's frame allowlist: the only frames its sender lets through. The clone handshake (ident,
 * `F`, `M`, the read cipher-select frame), 64-byte `R` reads and `E`. Nothing else, so no `W`, no `D`, no `UPDATE`,
 * no `AA 55` update frame and no upload cipher-select frame can leave the debug page's code path.
 */

import { RadioProtocolError } from '../../../kit/errors.ts';
import type { BytePipe } from '../../../types.ts';
import { UV5R_MINI_LAYOUT } from '../../uv17pro-family/layout.ts';

/** `E`: ends the clone session. */
export const UV5R_MINI_DEBUG_END_FRAME = Uint8Array.of(0x45);

const READ_OPCODE = 0x52;

const FIXED_FRAMES: readonly Uint8Array[] = [
  UV5R_MINI_LAYOUT.ident,
  ...UV5R_MINI_LAYOUT.magics.read.map((m) => m.send),
  UV5R_MINI_DEBUG_END_FRAME,
];

function same(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** True for a frame the debug read may send. */
export function isUv5rMiniDebugFrameAllowed(frame: Uint8Array): boolean {
  if (FIXED_FRAMES.some((f) => same(f, frame))) return true;
  return frame.length === 4 && frame[0] === READ_OPCODE && frame[3] === UV5R_MINI_LAYOUT.blockSize;
}

export class Uv5rMiniDebugFrameRefusedError extends RadioProtocolError {
  constructor(frame: Uint8Array) {
    const head = Array.from(frame.subarray(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
    super(`UV-5R Mini debug read refused to send a frame outside its allowlist (${head}…)`);
    this.name = 'Uv5rMiniDebugFrameRefusedError';
  }
}

/** One frame sent and the bytes read back before the next frame. */
export interface Uv5rMiniDebugExchange {
  tx: Uint8Array;
  rx: number[];
}

/**
 * A BytePipe that refuses any frame outside the allowlist before it reaches the transport, and records each frame
 * with the bytes read after it. Every write of the debug read goes through it.
 */
export class Uv5rMiniReadOnlyPipe implements BytePipe {
  private readonly exchanges: Uv5rMiniDebugExchange[] = [];

  constructor(private readonly inner: BytePipe) {}

  get baudRate(): number | undefined {
    return this.inner.baudRate;
  }

  async write(data: Uint8Array): Promise<void> {
    if (!isUv5rMiniDebugFrameAllowed(data)) throw new Uv5rMiniDebugFrameRefusedError(data);
    this.exchanges.push({ tx: data.slice(), rx: [] });
    await this.inner.write(data);
  }

  async readExact(n: number, timeoutMs: number): Promise<Uint8Array> {
    const bytes = await this.inner.readExact(n, timeoutMs);
    this.exchanges[this.exchanges.length - 1]?.rx.push(...bytes);
    return bytes;
  }

  async flush(): Promise<void> {
    await this.inner.flush?.();
  }

  async close(): Promise<void> {
    await this.inner.close();
  }

  /** The reply to the most recent frame equal to `tx`, or `undefined`. */
  replyTo(tx: Uint8Array): Uint8Array | undefined {
    for (let i = this.exchanges.length - 1; i >= 0; i--) {
      const e = this.exchanges[i]!;
      if (same(e.tx, tx)) return Uint8Array.from(e.rx);
    }
    return undefined;
  }

  /** The last `n` bytes read after the most recent frame. */
  lastReplyTail(n: number): Uint8Array {
    const last = this.exchanges[this.exchanges.length - 1];
    return Uint8Array.from(last ? last.rx.slice(-n) : []);
  }

  /** Drop the recorded exchanges (a full read keeps only what it needs). */
  forget(): void {
    this.exchanges.length = 0;
  }
}
