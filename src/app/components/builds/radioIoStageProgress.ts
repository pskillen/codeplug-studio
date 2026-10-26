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
}

export interface StageTracker {
  /** Row ids that have been active at least once. */
  seen: Readonly<Record<string, true>>;
  /** Highest completed fraction (0..1) reached per row id; never decreases. */
  frac: Readonly<Record<string, number>>;
  /** Moving-average rate in weight units per second, once known. */
  rate: number | null;
  lastAt: number | null;
  lastDone: number;
}

export const EMPTY_TRACKER: StageTracker = {
  seen: {},
  frac: {},
  rate: null,
  lastAt: null,
  lastDone: 0,
};

/** Time constant of the rate average, in seconds. */
export const RATE_TIME_CONSTANT_S = 5;
/** ETA appears after this much progress time. */
export const ETA_MIN_ELAPSED_MS = 2000;

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

/** Fraction done for a row, using the tracker for rows that moved on. */
export function rowFraction(row: StageRow, tracker: StageTracker, progress: ProgressUpdate | null) {
  if (row.status === 'success') return 1;
  if (row.status === 'active') {
    const live = progress?.max ? clamp01(progress.cur / progress.max) : 0;
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
  const next: StageTracker = { ...prev, seen, frac };
  const { done } = overallProgress(rows, next, progress);
  let rate = prev.rate;
  if (prev.lastAt != null && now > prev.lastAt && done >= prev.lastDone) {
    const dt = (now - prev.lastAt) / 1000;
    const inst = (done - prev.lastDone) / dt;
    if (rate == null) {
      if (done > prev.lastDone) rate = inst;
    } else {
      const alpha = 1 - Math.exp(-dt / RATE_TIME_CONSTANT_S);
      rate = rate + alpha * (inst - rate);
    }
  }
  return { ...next, rate, lastAt: now, lastDone: done };
}

/** Seconds left, or `null` when it cannot be estimated yet (never negative or NaN). */
export function etaSeconds(
  rows: readonly StageRow[],
  tracker: StageTracker,
  progress: ProgressUpdate | null,
  elapsedMs: number,
): number | null {
  if (elapsedMs < ETA_MIN_ELAPSED_MS) return null;
  const { done, total } = overallProgress(rows, tracker, progress);
  if (total <= 0 || tracker.rate == null || !(tracker.rate > 0)) return null;
  const left = (total - done) / tracker.rate;
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
