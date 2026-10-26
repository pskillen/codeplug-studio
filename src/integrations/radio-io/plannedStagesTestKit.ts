/**
 * Test helpers for per-adapter planned-stage tests (#1393). Test code only.
 */

import { expect } from 'vitest';
import type { PlannedStage, ProgressFn, ProgressUpdate } from './types.ts';

/** Collects `stage` labels in first-seen order. */
export function stageRecorder(): { onProgress: ProgressFn; stages: string[] } {
  const stages: string[] = [];
  return {
    stages,
    onProgress: (p: ProgressUpdate) => {
      if (p.stage && !stages.includes(p.stage)) stages.push(p.stage);
    },
  };
}

/**
 * Every emitted stage is declared, every declared non-optional stage was emitted, weights are
 * finite and non-negative, and labels are unique.
 */
export function expectPlanMatchesEmitted(
  plan: readonly PlannedStage[],
  emitted: readonly string[],
): void {
  const labels = plan.map((s) => s.label);
  expect(new Set(labels).size).toBe(labels.length);
  for (const s of plan) {
    expect(Number.isFinite(s.weight)).toBe(true);
    expect(s.weight).toBeGreaterThanOrEqual(0);
  }
  expect(labels).toEqual(expect.arrayContaining([...emitted]));
  const required = plan.filter((s) => !s.optional).map((s) => s.label);
  expect(emitted).toEqual(expect.arrayContaining(required));
}
