/**
 * Stage cursor for the progress window (#1393): maps the adapter's `ProgressUpdate` stream onto
 * the declared plan so progress only moves forward.
 *
 * Adapters re-emit labels (the DM-32UV discovers its memory map twice and restarts `cur` at 0 for
 * every pre-write block group; OpenGD77 reads twice; the D890 keps writer emits 'Upload' again).
 * Rules, applied per event with a label:
 *
 * - The event belongs to the cursor row when it has the same label, otherwise to the next row
 *   after the cursor with that label (a plan may name a label twice, in emission order). An event
 *   for a label that only occurs before the cursor is ignored: it is stale, not a step back.
 * - `cur` dropping on the cursor row starts the next pass (`PlannedStage.passes`); the row's held
 *   fraction is `(pass + cur / max) / passes` and never decreases.
 * - An event at `cur` 0 only advances the cursor to the next row, and only when the cursor row
 *   looks finished. This ignores the DM-32UV "Queued" seed burst (one `cur` 0 event per group
 *   before any write) and the zero event that opens a pass.
 * - `coarse` rows (D890 download: `cur` is the stage index) hold fraction 0 until they complete.
 * - A label the plan never named is appended by the caller; events for it always advance.
 */

import type { ProgressUpdate } from '@integrations/radio-io/types.ts';

export interface CursorRow {
  label: string;
  optional?: boolean;
  passes?: number;
  coarse?: boolean;
  /** Appended by the caller because the plan did not name it. */
  unplanned?: boolean;
}

export interface StageCursor {
  /** Index of the current row, or -1 before any event moved it. */
  index: number;
  pass: number;
  lastCur: number;
  lastMax: number;
  /** Held fraction (0..1) per row index; never decreases. */
  frac: readonly number[];
}

export const START_CURSOR: StageCursor = { index: -1, pass: 0, lastCur: 0, lastMax: 0, frac: [] };

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

function looksFinished(c: StageCursor, rows: readonly CursorRow[]): boolean {
  if (c.index < 0) return true;
  if (rows[c.index]?.coarse) return true;
  return c.lastMax > 0 && c.lastCur >= c.lastMax;
}

/** Fold one progress event into the cursor. Pure. */
export function foldStageEvent(
  cursor: StageCursor,
  rows: readonly CursorRow[],
  event: ProgressUpdate,
): StageCursor {
  const label = event.stage;
  if (!label) return cursor;
  let target = -1;
  if (cursor.index >= 0 && rows[cursor.index]?.label === label) {
    target = cursor.index;
  } else {
    for (let j = cursor.index + 1; j < rows.length; j++) {
      if (rows[j]!.label === label) {
        target = j;
        break;
      }
    }
  }
  if (target < 0) return cursor;

  const advancing = target !== cursor.index;
  if (advancing && event.cur <= 0 && !rows[target]!.unplanned) {
    const between = rows.slice(cursor.index + 1, target);
    if (!between.every((r) => r.optional) || !looksFinished(cursor, rows)) return cursor;
  }

  const row = rows[target]!;
  const passes = Math.max(1, row.passes ?? 1);
  let pass = advancing ? 0 : cursor.pass;
  if (!advancing && event.cur < cursor.lastCur) pass = Math.min(pass + 1, passes - 1);
  const inner = event.max > 0 ? clamp01(event.cur / event.max) : 0;
  const raw = row.coarse ? 0 : clamp01((pass + inner) / passes);
  const frac = Array.from({ length: rows.length }, (_, i) => cursor.frac[i] ?? 0);
  frac[target] = Math.max(frac[target] ?? 0, raw);
  return { index: target, pass, lastCur: event.cur, lastMax: event.max, frac };
}
