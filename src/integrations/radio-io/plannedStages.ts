/**
 * Planned-stage helpers shared by adapters and the progress UI (#1393).
 * See docs/features/radio-read-write/protocol-kit-architecture.md (planned stages).
 */

import type {
  PlannedStage,
  RadioDescriptor,
  RadioOperation,
  RadioPlanContext,
} from './types.ts';

/** The adapter's plan for `op`, or `undefined` when it declares none (UI falls back to a growing list). */
export function planForOperation(
  descriptor: RadioDescriptor,
  op: RadioOperation,
  ctx: RadioPlanContext = {},
): PlannedStage[] | undefined {
  const plan = descriptor.planStages?.(op, ctx);
  return plan && plan.length > 0 ? plan : undefined;
}

/**
 * Merge stages that share a label (one label can be emitted by two code paths, for example the
 * D890 'Upload' of codeplug and keps): weights add, and the result is optional only if all were.
 * First occurrence fixes the position.
 */
export function mergeDuplicateStages(stages: readonly PlannedStage[]): PlannedStage[] {
  const out: PlannedStage[] = [];
  for (const s of stages) {
    const prev = out.findIndex((o) => o.label === s.label);
    if (prev < 0) {
      out.push({ ...s, weight: Math.max(0, s.weight) });
      continue;
    }
    const p = out[prev]!;
    out[prev] = {
      label: p.label,
      weight: p.weight + Math.max(0, s.weight),
      ...(p.optional && s.optional ? { optional: true } : {}),
    };
  }
  return out;
}

/** Sum of all stage weights. */
export function totalPlanWeight(plan: readonly PlannedStage[]): number {
  return plan.reduce((sum, s) => sum + Math.max(0, s.weight), 0);
}
