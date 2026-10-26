/**
 * Plan and row helpers for the Write stepper (#1393): split a write plan into its read part (the
 * step 2 list) and its write part (the step 4 list), and turn plan + progress into list rows.
 * Pure.
 */

import { planForOperation } from '@integrations/radio-io/plannedStages.ts';
import type {
  PlannedStage,
  ProgressUpdate,
  RadioDescriptor,
  RadioPlanContext,
} from '@integrations/radio-io/types.ts';
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
 * Rows for `RadioIoStageList`: the plan's stages, then any stage the adapter emitted that the plan
 * did not name. `activeLabel` is the latest `ProgressUpdate.stage`; rows before it are done.
 */
export function stageRows(opts: {
  plan: readonly PlannedStage[] | undefined;
  grown: readonly string[];
  progress: ProgressUpdate | null;
  /** All rows done. */
  finished?: boolean;
  /** Mark the first row active before any progress event has arrived. */
  startActive?: boolean;
}): WriteStageRow[] {
  const weights = new Map((opts.plan ?? []).map((p) => [p.label, p]));
  const labels = [
    ...(opts.plan ?? []).map((p) => p.label),
    ...opts.grown.filter((l) => !weights.has(l)),
  ];
  const activeLabel = opts.progress?.stage;
  let activeIdx = activeLabel ? labels.indexOf(activeLabel) : -1;
  if (activeIdx < 0 && opts.startActive && !opts.finished) activeIdx = 0;
  return labels.map((label, i) => {
    const p = weights.get(label);
    const status: WriteStageRow['status'] = opts.finished
      ? 'success'
      : i < activeIdx
        ? 'success'
        : i === activeIdx
          ? 'active'
          : 'pending';
    return {
      id: `stage:${label}`,
      label,
      status,
      ...(p ? { weight: p.weight, ...(p.optional ? { optional: true } : {}) } : {}),
    };
  });
}
