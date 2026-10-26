/**
 * Per-stage timings for a radio operation (#1406).
 *
 * Wraps a progress callback and records, per stage label in first-seen order, when the stage
 * started and ended, how many events it emitted and how long it ran, with the Review pause
 * excluded. When given a counter sampler it also attributes the counter deltas (for example the
 * `R` and `W` frames a radio sent) to the stage that was active. Radio neutral.
 */

import type { ProgressFn, ProgressUpdate } from '../types.ts';

export type StageCounters = Readonly<Record<string, number>>;

export interface StageTimelineRow {
  stage: string;
  /** Progress events seen for this stage. */
  events: number;
  /** Milliseconds from the timeline's start to the stage's first and last event. */
  firstAtMs: number;
  lastAtMs: number;
  /** Time spent in the stage, to the next stage's first event (or to `report()`), pause excluded. */
  durationMs: number;
  /** Counter deltas attributed to the stage; present only with a sampler. */
  counters?: Record<string, number>;
}

export interface StageTimelineReport {
  rows: StageTimelineRow[];
  /** Time the Review pause held the Write, excluded from every row and from `totalMs`. */
  pauseMs: number;
  /** Start to `report()`, pause excluded. */
  totalMs: number;
}

export interface StageTimeline {
  onProgress: ProgressFn;
  markPauseStart(): void;
  markPauseEnd(): void;
  report(): StageTimelineReport;
}

const NO_STAGE = '(no stage)';

export function createStageTimeline(
  onProgress?: ProgressFn,
  now: () => number = Date.now,
  sampleCounters?: () => StageCounters,
): StageTimeline {
  const t0 = now();
  // Frames sent before the first event belong to the first stage.
  let firstBase: StageCounters | undefined = sampleCounters?.();
  const rows = new Map<string, StageTimelineRow>();
  let pausedDone = 0;
  let pauseStartedAt: number | null = null;

  const paused = (t: number) => pausedDone + (pauseStartedAt === null ? 0 : t - pauseStartedAt);
  /** Time since the start with the pause taken out. */
  const active = (t: number) => t - t0 - paused(t);

  let current: {
    row: StageTimelineRow;
    startActive: number;
    startCounters?: StageCounters;
  } | null = null;

  function close(t: number): void {
    if (!current) return;
    const { row, startActive, startCounters } = current;
    row.durationMs += active(t) - startActive;
    if (sampleCounters && startCounters) {
      const end = sampleCounters();
      const acc = (row.counters ??= {});
      for (const [k, v] of Object.entries(end))
        acc[k] = (acc[k] ?? 0) + (v - (startCounters[k] ?? 0));
    }
    current = null;
  }

  function wrapped(p: ProgressUpdate): void {
    const t = now();
    const stage = p.stage ?? NO_STAGE;
    if (!current || current.row.stage !== stage) {
      close(t);
      let row = rows.get(stage);
      if (!row) {
        row = {
          stage,
          events: 0,
          firstAtMs: active(t),
          lastAtMs: active(t),
          durationMs: 0,
          ...(sampleCounters ? { counters: {} } : {}),
        };
        rows.set(stage, row);
      }
      current = {
        row,
        startActive: active(t),
        ...(sampleCounters ? { startCounters: firstBase ?? sampleCounters() } : {}),
      };
    }
    firstBase = undefined;
    current.row.events += 1;
    current.row.lastAtMs = active(t);
    onProgress?.(p);
  }

  return {
    onProgress: wrapped,
    markPauseStart() {
      if (pauseStartedAt === null) pauseStartedAt = now();
    },
    markPauseEnd() {
      if (pauseStartedAt !== null) {
        pausedDone += now() - pauseStartedAt;
        pauseStartedAt = null;
      }
    },
    report() {
      const t = now();
      close(t);
      return {
        rows: [...rows.values()].map((r) => ({
          ...r,
          ...(r.counters ? { counters: { ...r.counters } } : {}),
        })),
        pauseMs: paused(t),
        totalMs: active(t),
      };
    },
  };
}
