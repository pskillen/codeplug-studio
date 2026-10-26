/**
 * Plan and row helpers for the Write stepper (#1393): split a write plan into its read part (the
 * step 2 list) and its write part (the step 4 list), and turn plan + progress into list rows with
 * 4a's stage cursor (`radioIoStageCursor.ts`, the same fold `RadioIoProgressModal` uses). Pure.
 */

import { planForOperation } from '@integrations/radio-io/plannedStages.ts';
import type {
  PlannedStage,
  ProgressUpdate,
  RadioDescriptor,
  RadioPlanContext,
} from '@integrations/radio-io/types.ts';
import {
  foldStageEvent,
  START_CURSOR,
  type CursorRow,
  type StageCursor,
} from '../radioIoStageCursor.ts';
import type { WriteStageRow } from './types.ts';

/** The stage radios without a 'read' plan emit for their in-session read before a Write. */
export const PRE_WRITE_READ_LABEL = 'Pre-write read';

/**
 * The stages of the in-session read: the descriptor's 'read' plan when it has one (AT-D890UV),
 * else the write plan up to and including 'Pre-write read'. Empty when the radio declares none.
 */
export function readPlanFor(descriptor: RadioDescriptor, ctx: RadioPlanContext): PlannedStage[] {
  const explicit = planForOperation(descriptor, 'read', ctx);
  if (explicit) return explicit;
  const write = planForOperation(descriptor, 'write', ctx) ?? [];
  const idx = write.findIndex((s) => s.label === PRE_WRITE_READ_LABEL);
  return idx >= 0 ? write.slice(0, idx + 1) : [];
}

/** The write plan without the read stages (they were shown in step 2). */
export function writePartOfPlan(
  plan: readonly PlannedStage[] | undefined,
  readPlan: readonly PlannedStage[],
): PlannedStage[] | undefined {
  if (!plan) return undefined;
  const readLabels = new Set(readPlan.map((s) => s.label));
  const rest = plan.filter((s) => !readLabels.has(s.label));
  return rest.length > 0 ? rest : undefined;
}

/**
 * One list's progress: its plan, the unplanned labels adapters emitted, the events seen (kept so a
 * plan that arrives late can be replayed) and the stage cursor folded from them. The `events`
 * array is shared between versions of a track and only ever appended to.
 */
export interface StageTrack {
  plan: readonly PlannedStage[] | undefined;
  grown: readonly string[];
  events: ProgressUpdate[];
  cursor: StageCursor;
}

/** A fresh track (a new events array each time). */
export function newTrack(): StageTrack {
  return { plan: undefined, grown: [], events: [], cursor: START_CURSOR };
}

/** The cursor's rows: the plan's stages (with `coarse`, `passes`, `optional`), then unplanned ones. */
export function cursorRowsOf(track: Pick<StageTrack, 'plan' | 'grown'>): CursorRow[] {
  const plan = track.plan ?? [];
  const known = new Set(plan.map((p) => p.label));
  return [
    ...plan.map((p) => ({
      label: p.label,
      ...(p.optional ? { optional: true } : {}),
      ...(p.passes ? { passes: p.passes } : {}),
      ...(p.coarse ? { coarse: true } : {}),
    })),
    ...track.grown.filter((l) => !known.has(l)).map((label) => ({ label, unplanned: true })),
  ];
}

function replay(track: Pick<StageTrack, 'plan' | 'grown' | 'events'>): StageCursor {
  const rows = cursorRowsOf(track);
  let cursor = START_CURSOR;
  for (const e of track.events) cursor = foldStageEvent(cursor, rows, e);
  return cursor;
}

/** Set (or replace) the plan; replays the events seen so far against it. */
export function trackWithPlan(
  track: StageTrack,
  plan: readonly PlannedStage[] | undefined,
): StageTrack {
  const next = { ...track, plan };
  return { ...next, cursor: replay(next) };
}

/** Fold one event with a stage label into the track, appending the label as a row if unplanned. */
export function trackWithEvent(track: StageTrack, event: ProgressUpdate): StageTrack {
  const label = event.stage;
  if (!label) return track;
  track.events.push(event);
  const known = (track.plan ?? []).some((p) => p.label === label) || track.grown.includes(label);
  if (known) {
    return { ...track, cursor: foldStageEvent(track.cursor, cursorRowsOf(track), event) };
  }
  const next = { ...track, grown: [...track.grown, label] };
  return { ...next, cursor: replay(next) };
}

/**
 * Rows for `RadioIoStageList`, one per cursor row, in plan order. Rows before the cursor are
 * done, the cursor row is active; `coarse` and `fraction` come from the shared cursor.
 */
export function stageRows(
  track: StageTrack,
  opts: {
    /** All rows done. */
    finished?: boolean;
    /** Mark the first row active before any progress event has arrived. */
    startActive?: boolean;
  } = {},
): WriteStageRow[] {
  const plan = track.plan ?? [];
  const rows = cursorRowsOf(track);
  let activeIdx = track.cursor.index;
  if (activeIdx < 0 && opts.startActive && !opts.finished) activeIdx = 0;
  return rows.map((row, i) => {
    const p = plan[i];
    const status: WriteStageRow['status'] = opts.finished
      ? 'success'
      : i < activeIdx
        ? 'success'
        : i === activeIdx
          ? 'active'
          : 'pending';
    return {
      id: `stage:${i}`,
      label: row.label,
      status,
      ...(p ? { weight: p.weight } : {}),
      ...(row.optional ? { optional: true } : {}),
      ...(row.coarse ? { coarse: true } : {}),
      fraction: opts.finished ? 1 : (track.cursor.frac[i] ?? 0),
    };
  });
}
