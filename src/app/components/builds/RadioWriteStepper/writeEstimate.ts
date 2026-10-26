/**
 * Review's time estimate (#1393): the write plan's total weight over the throughput Studio measured
 * during the read in step 2, never slower than the radio's nominal rate.
 * Pure; no clock.
 */

import type { PlannedStage } from '@integrations/radio-io/types.ts';
import { totalPlanWeight } from '@integrations/radio-io/plannedStages.ts';

/**
 * Nominal wire throughput when the radio declares none (bytes per second). Deliberately on the
 * optimistic side: a first estimate of half an hour for a sub-minute write scares people off.
 */
export const NOMINAL_BYTES_PER_SECOND = 16_000;

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
  nominalBytesPerSecond: number = NOMINAL_BYTES_PER_SECOND,
): number | null {
  if (!writePlan || writePlan.length === 0) return null;
  const weight = totalPlanWeight(writePlan);
  if (weight <= 0) return null;
  // The nominal rate is a floor: measured rates come from nominal read-plan weights and run low.
  const rate = Math.max(
    bytesPerSecond && bytesPerSecond > 0 ? bytesPerSecond : 0,
    nominalBytesPerSecond,
  );
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
