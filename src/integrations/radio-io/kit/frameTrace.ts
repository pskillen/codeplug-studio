/**
 * Ring buffer of the last radio frames, for protocol error details.
 *
 * Wrap a {@link BytePipe} in {@link TracingPipe} and every write / read is recorded. A protocol
 * attaches the formatted trace to its error as `debugText`, so a hardware report shows what was
 * on the wire.
 */

import type { BytePipe } from '../types.ts';

export type TraceDirection = 'TX' | 'RX' | 'ERR' | 'STALE' | 'NOTE';

export interface TraceFrame {
  dir: TraceDirection;
  /** Hex of the (possibly truncated) frame, or free text for ERR / NOTE. */
  text: string;
  /** Milliseconds since the trace was created. */
  at: number;
}

export const FRAME_TRACE_DEFAULT_CAPACITY = 24;
const HEX_PREVIEW_BYTES = 16;

export function hexBytes(bytes: Uint8Array, max = HEX_PREVIEW_BYTES): string {
  const shown = Array.from(bytes.subarray(0, max), (b) => b.toString(16).padStart(2, '0')).join(
    ' ',
  );
  return bytes.length > max ? `${shown} … (${bytes.length} bytes)` : shown;
}

export class FrameTrace {
  private readonly frames: TraceFrame[] = [];
  private readonly started = Date.now();

  constructor(private readonly capacity = FRAME_TRACE_DEFAULT_CAPACITY) {}

  push(dir: TraceDirection, text: string): void {
    this.frames.push({ dir, text, at: Date.now() - this.started });
    if (this.frames.length > this.capacity) this.frames.shift();
  }

  snapshot(): readonly TraceFrame[] {
    return this.frames.slice();
  }

  /** Copyable multi-line text, oldest first. Empty string when nothing was recorded. */
  format(): string {
    if (this.frames.length === 0) return '';
    const lines = this.frames.map(
      (f) => `+${String(f.at).padStart(6, '0')}ms ${f.dir.padEnd(5)} ${f.text}`,
    );
    return [`Last ${this.frames.length} radio frames (oldest first):`, ...lines].join('\n');
  }
}

/** Forwards to `inner`, recording each write and read in `trace`. */
export class TracingPipe implements BytePipe {
  constructor(
    private readonly inner: BytePipe,
    readonly trace: FrameTrace,
  ) {}

  get baudRate(): number | undefined {
    return this.inner.baudRate;
  }

  async write(data: Uint8Array): Promise<void> {
    this.trace.push('TX', hexBytes(data));
    await this.inner.write(data);
  }

  async readExact(n: number, timeoutMs: number): Promise<Uint8Array> {
    try {
      const bytes = await this.inner.readExact(n, timeoutMs);
      this.trace.push('RX', hexBytes(bytes));
      return bytes;
    } catch (err) {
      this.trace.push(
        'ERR',
        `read ${n} byte(s): ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }

  async flush(): Promise<void> {
    await this.inner.flush?.();
  }

  /** Drain pending bytes; anything found is recorded as STALE. */
  async drain(): Promise<Uint8Array> {
    if (this.inner.drain) {
      const pending = await this.inner.drain();
      if (pending.length > 0) this.trace.push('STALE', hexBytes(pending));
      return pending;
    }
    await this.inner.flush?.();
    return new Uint8Array(0);
  }

  async close(): Promise<void> {
    await this.inner.close();
  }
}
