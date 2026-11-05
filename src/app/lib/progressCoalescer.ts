/**
 * Coalesces a firehose of radio progress events into a few UI updates (#1558).
 *
 * The AT-D890UV contact write emits one event per 16-byte frame (about two million for 300k
 * contacts). Pushing each into React state re-rendered the whole Write panel per frame and cost
 * more than the radio round trip. The coalescer lets at most one event per `intervalMs` reach the
 * UI (time-based, not frame-count-based), with a trailing flush so the last event is never lost.
 *
 * Events that matter go through at once and are never dropped or reordered:
 * - the first event after a quiet spell (leading edge);
 * - an event whose `stage` differs from the previous event's (a stage change);
 * - an event that completes its stage (`cur >= max`).
 *
 * Callers fold every event into their own refs for exactness and call `push` only to schedule the
 * state flush. Pure of React: the clock and timers are injectable.
 */

import type { ProgressUpdate } from '@integrations/radio-io/types.ts';

/** About 10 Hz. */
export const PROGRESS_FLUSH_INTERVAL_MS = 100;

export interface ProgressCoalescer {
  /** Offer one event; it is emitted now or by the trailing timer. */
  push(event: ProgressUpdate): void;
  /** Emit the pending event now, if any. */
  flush(): void;
  /** Drop the pending event and timer (a reset or unmount). */
  cancel(): void;
}

export interface ProgressCoalescerOptions {
  intervalMs?: number;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export function createProgressCoalescer(
  emit: (event: ProgressUpdate) => void,
  options: ProgressCoalescerOptions = {},
): ProgressCoalescer {
  const intervalMs = options.intervalMs ?? PROGRESS_FLUSH_INTERVAL_MS;
  const now = options.now ?? (() => performance.now());
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer =
    options.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));

  let pending: ProgressUpdate | null = null;
  let timer: unknown = null;
  let lastEmitAt = Number.NEGATIVE_INFINITY;
  let lastStage: string | undefined;
  let seen = false;

  function clearPendingTimer() {
    if (timer != null) {
      clearTimer(timer);
      timer = null;
    }
  }

  function emitNow(event: ProgressUpdate) {
    pending = null;
    clearPendingTimer();
    lastEmitAt = now();
    emit(event);
  }

  return {
    push(event) {
      const stageChanged = seen && event.stage !== lastStage;
      seen = true;
      lastStage = event.stage;
      const complete = event.max > 0 && event.cur >= event.max;
      if (stageChanged || complete || now() - lastEmitAt >= intervalMs) {
        emitNow(event);
        return;
      }
      pending = event;
      if (timer == null) {
        const wait = Math.max(0, intervalMs - (now() - lastEmitAt));
        timer = setTimer(() => {
          timer = null;
          if (pending) emitNow(pending);
        }, wait);
      }
    },
    flush() {
      if (pending) emitNow(pending);
    },
    cancel() {
      pending = null;
      seen = false;
      lastStage = undefined;
      lastEmitAt = Number.NEGATIVE_INFINITY;
      clearPendingTimer();
    },
  };
}
