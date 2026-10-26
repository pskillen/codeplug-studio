/**
 * Review's time estimate (#1393): the write plan's total weight over the throughput Studio measured
 * during the read in step 2, falling back to a nominal rate when the radio declared no read plan.
 * Pure; no clock.
 */

import type { PlannedStage } from '@integrations/radio-io/types.ts';
import { totalPlanWeight } from '@integrations/radio-io/plannedStages.ts';

/** Nominal wire throughput when none was measured (bytes per second). A rough serial-link figure. */
export const NOMINAL_BYTES_PER_SECOND = 4000;

/** Reads shorter than this are too quick to give a stable rate. */
const MIN_MEASURE_MS = 1500;

/** Bytes per second from the read plan and how long the read took; `null` when not measurable. */
export function measuredThroughput(
  readPlan: readonly PlannedStage[] | undefined,
  readMs: number,
): number | null {
  if (!readPlan || readPlan.length === 0 || readMs < MIN_MEASURE_MS) return null;
  const weight = totalPlanWeight(readPlan);
  if (weight <= 0) return null;
  return weight / (readMs / 1000);
}

/** Seconds to send `writePlan`, or `null` when the plan has no weights. */
export function estimateWriteSeconds(
  writePlan: readonly PlannedStage[] | undefined,
  bytesPerSecond: number | null,
): number | null {
  if (!writePlan || writePlan.length === 0) return null;
  const weight = totalPlanWeight(writePlan);
  if (weight <= 0) return null;
  const rate = bytesPerSecond && bytesPerSecond > 0 ? bytesPerSecond : NOMINAL_BYTES_PER_SECOND;
  return weight / rate;
}

/** "About 1 min 40 s", "About 35 s", "Under 10 s". */
export function formatEstimate(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 10) return 'Under 10 s';
  if (s < 60) return `About ${Math.round(s / 5) * 5} s`;
  const m = Math.floor(s / 60);
  const rest = Math.round((s % 60) / 5) * 5;
  if (rest === 60) return `About ${m + 1} min`;
  return rest === 0 ? `About ${m} min` : `About ${m} min ${rest} s`;
}
