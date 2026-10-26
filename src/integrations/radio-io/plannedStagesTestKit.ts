/**
 * Test helpers for per-adapter planned-stage tests (#1393). Test code only.
 */

import { expect } from 'vitest';
import type { PlannedStage, ProgressFn, ProgressUpdate } from './types.ts';

/**
 * Records every progress event in order (`events`) and the labels in first-seen order (`stages`).
 * Order checks must use `events`: `stages` drops repeats, which is exactly what hides a stage
 * that an adapter re-enters.
 */
export function stageRecorder(): {
  onProgress: ProgressFn;
  stages: string[];
  events: ProgressUpdate[];
} {
  const stages: string[] = [];
  const events: ProgressUpdate[] = [];
  return {
    stages,
    events,
    onProgress: (p: ProgressUpdate) => {
      events.push({ ...p });
      if (p.stage && !stages.includes(p.stage)) stages.push(p.stage);
    },
  };
}

function expectSaneWeights(plan: readonly PlannedStage[]): void {
  for (const s of plan) {
    expect(Number.isFinite(s.weight)).toBe(true);
    expect(s.weight).toBeGreaterThanOrEqual(0);
    if (s.passes != null) expect(s.passes).toBeGreaterThanOrEqual(1);
  }
}

/**
 * Every emitted stage is declared, every declared non-optional stage was emitted, and weights are
 * finite and non-negative. A label may be declared twice (a stage the adapter enters twice).
 */
export function expectPlanMatchesEmitted(
  plan: readonly PlannedStage[],
  emitted: readonly string[],
): void {
  expectSaneWeights(plan);
  const labels = plan.map((s) => s.label);
  expect(labels).toEqual(expect.arrayContaining([...emitted]));
  const required = plan.filter((s) => !s.optional).map((s) => s.label);
  expect(emitted).toEqual(expect.arrayContaining(required));
}

/** Every emitted stage is declared (use when a scenario skips a declared step, e.g. a seeded read). */
export function expectEmittedWithinPlan(
  plan: readonly PlannedStage[],
  emitted: readonly string[],
): void {
  expect(plan.map((s) => s.label)).toEqual(expect.arrayContaining([...emitted]));
}

/**
 * The whole ordered event stream follows the plan: the runs of labels (events at `cur` 0 are
 * markers and skipped, as the progress window skips them) are an in-order subsequence of the
 * plan, a label declared twice is matched occurrence by occurrence, and every non-optional
 * declared stage occurs. Catches a re-entered label the plan does not account for.
 */
export function expectEventsFollowPlan(
  plan: readonly PlannedStage[],
  events: readonly ProgressUpdate[],
): void {
  expectSaneWeights(plan);
  const runs: string[] = [];
  for (const e of events) {
    if (!e.stage || e.cur <= 0) continue;
    if (runs[runs.length - 1] !== e.stage) runs.push(e.stage);
  }
  let at = -1;
  for (const label of runs) {
    if (plan[at]?.label === label) {
      // Still the same stage (a repeat after a marker event).
      continue;
    }
    const next = plan.findIndex((s, i) => i > at && s.label === label);
    expect(next, `"${label}" is out of plan order (runs: ${runs.join(' > ')})`).toBeGreaterThan(-1);
    at = next;
  }
  const everLabels = new Set(events.map((e) => e.stage).filter(Boolean));
  const missing = plan.filter((s) => !s.optional && !everLabels.has(s.label)).map((s) => s.label);
  expect(missing, 'declared non-optional stages never emitted').toEqual([]);
}
