/**
 * Pure progress arithmetic for `RadioIoStageList` (#1393): per-stage fractions, the weighted
 * overall fraction, and a time-remaining estimate from a moving average of the transfer rate.
 * No React, no clock: callers pass `now` (ms).
 */

import type { ProgressUpdate } from '@integrations/radio-io/types.ts';

export type StageRowStatus = 'pending' | 'active' | 'success' | 'error';

export interface StageRow {
  id: string;
  label: string;
  status: StageRowStatus;
  detail?: string;
  /** Estimated bytes for this row. Rows without a weight are shown but not counted. */
  weight?: number;
  /** Optional rows that were passed without ever being active are dropped from the total. */
  optional?: boolean;
  /**
   * Held fraction (0..1) of this row, from the stage cursor. When set it replaces the fraction
   * derived from the latest event, so a re-emitted label cannot move the row backwards.
   */
  fraction?: number;
  /** `cur/max` of this row's events is a step index, not progress inside it: no per-step bar. */
  coarse?: boolean;
}

export interface StageTracker {
  /** Row ids that have been active at least once. */
  seen: Readonly<Record<string, true>>;
  /** Highest completed fraction (0..1) reached per row id; never decreases. */
  frac: Readonly<Record<string, number>>;
  /** Moving-average rate in weight units per second, once known. */
  rate: number | null;
  /** When the first progress event arrived (ms). The estimate waits 2 s from here. */
  firstAt: number | null;
  /** Done weight when the first progress event arrived (work before the clock started). */
  firstDone: number;
  /** When the done weight last increased (ms). */
  lastAt: number | null;
  lastDone: number;
}

export const EMPTY_TRACKER: StageTracker = {
  seen: {},
  frac: {},
  rate: null,
  firstAt: null,
  firstDone: 0,
  lastAt: null,
  lastDone: 0,
};

/** Time constant of the rate average, in seconds. */
export const RATE_TIME_CONSTANT_S = 5;
/** ETA appears after this much time since the first progress event. */
export const ETA_MIN_ELAPSED_MS = 2000;
/** When done weight has not moved for this long, the whole-run average rate replaces the moving one. */
export const ETA_STALE_MS = 2000;

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

/** Fraction done for a row, using the tracker for rows that moved on. */
export function rowFraction(row: StageRow, tracker: StageTracker, progress: ProgressUpdate | null) {
  if (row.status === 'success') return 1;
  if (row.status === 'active') {
    const live =
      row.fraction != null
        ? clamp01(row.fraction)
        : row.coarse
          ? 0
          : progress?.max
            ? clamp01(progress.cur / progress.max)
            : 0;
    return Math.max(tracker.frac[row.id] ?? 0, live);
  }
  return 0;
}

/** Rows that count towards the overall bar. */
function countedRows(rows: readonly StageRow[], tracker: StageTracker): StageRow[] {
  return rows.filter(
    (r) =>
      r.weight != null &&
      r.weight > 0 &&
      !(r.optional && r.status === 'success' && !tracker.seen[r.id]),
  );
}

/** Weighted overall fraction (0..1) and the total weight counted. */
export function overallProgress(
  rows: readonly StageRow[],
  tracker: StageTracker,
  progress: ProgressUpdate | null,
): { fraction: number; done: number; total: number } {
  const counted = countedRows(rows, tracker);
  const total = counted.reduce((sum, r) => sum + (r.weight ?? 0), 0);
  if (total <= 0) return { fraction: 0, done: 0, total: 0 };
  const done = counted.reduce(
    (sum, r) => sum + (r.weight ?? 0) * rowFraction(r, tracker, progress),
    0,
  );
  return { fraction: clamp01(done / total), done, total };
}

/** Fold one render's rows and progress into the tracker. */
export function advanceTracker(
  prev: StageTracker,
  rows: readonly StageRow[],
  progress: ProgressUpdate | null,
  now: number,
): StageTracker {
  const seen: Record<string, true> = { ...prev.seen };
  const frac: Record<string, number> = { ...prev.frac };
  for (const row of rows) {
    if (row.status === 'active') {
      seen[row.id] = true;
      frac[row.id] = Math.max(frac[row.id] ?? 0, rowFraction(row, prev, progress));
    } else if (row.status === 'success') {
      frac[row.id] = 1;
    }
  }
  const firstAt = prev.firstAt ?? (progress ? now : null);
  const next: StageTracker = { ...prev, seen, frac, firstAt };
  const { done } = overallProgress(rows, next, progress);
  const firstDone = prev.firstAt == null ? done : prev.firstDone;
  let { rate, lastAt, lastDone } = prev;
  if (done > prev.lastDone) {
    // Sample only when done weight moves, over the time since it last moved: a long read between
    // sparse events then counts as slow progress instead of decaying the rate.
    const origin = prev.lastAt ?? firstAt;
    if (origin != null && firstAt != null && now > origin) {
      const dt = (now - origin) / 1000;
      const inst = (done - prev.lastDone) / dt;
      if (rate == null) {
        rate = (done - firstDone) / ((now - firstAt) / 1000);
      } else {
        const alpha = 1 - Math.exp(-dt / RATE_TIME_CONSTANT_S);
        rate = rate + alpha * (inst - rate);
      }
    }
    lastAt = now;
    lastDone = done;
  }
  return { ...next, firstDone, rate, lastAt, lastDone };
}

/** Seconds left, or `null` when it cannot be estimated yet (never negative or NaN). */
export function etaSeconds(
  rows: readonly StageRow[],
  tracker: StageTracker,
  progress: ProgressUpdate | null,
  now: number,
): number | null {
  if (tracker.firstAt == null || now - tracker.firstAt < ETA_MIN_ELAPSED_MS) return null;
  const { done, total } = overallProgress(rows, tracker, progress);
  if (total <= 0) return null;
  const avg =
    done > tracker.firstDone ? (done - tracker.firstDone) / ((now - tracker.firstAt) / 1000) : null;
  const stale = tracker.lastAt == null || now - tracker.lastAt > ETA_STALE_MS;
  const rate = stale ? avg : (tracker.rate ?? avg);
  if (rate == null || !(rate > 0)) return null;
  const left = (total - done) / rate;
  return Number.isFinite(left) ? Math.max(0, left) : null;
}

/** "About 2 min 5 s left", "About 40 s left". */
export function formatEta(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 5) return 'Almost done';
  if (s < 60) return `About ${s} s left`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest === 0 ? `About ${m} min left` : `About ${m} min ${rest} s left`;
}
