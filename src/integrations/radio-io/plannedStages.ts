/**
 * Planned-stage helpers shared by adapters and the progress UI (#1393).
 * See docs/features/radio-read-write/protocol-kit-architecture.md (planned stages).
 */

import type { PlannedStage, RadioDescriptor, RadioOperation, RadioPlanContext } from './types.ts';

/**
 * The adapter's plan for `op`, or `undefined` when it declares none (UI falls back to a growing
 * list). A plan is advisory: one that throws (for example a contact set the packer rejects) must
 * never block the transfer, so it counts as no plan and the transfer reports the real error.
 */
export function planForOperation(
  descriptor: RadioDescriptor,
  op: RadioOperation,
  ctx: RadioPlanContext = {},
): PlannedStage[] | undefined {
  try {
    const plan = descriptor.planStages?.(op, ctx);
    return plan && plan.length > 0 ? plan : undefined;
  } catch {
    return undefined;
  }
}

/** Sum of all stage weights. */
export function totalPlanWeight(plan: readonly PlannedStage[]): number {
  return plan.reduce((sum, s) => sum + Math.max(0, s.weight), 0);
}
