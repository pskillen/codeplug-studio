import { describe, expect, it } from 'vitest';
import { listRadioDescriptors } from './registry.ts';
import { mergeDuplicateStages, planForOperation, totalPlanWeight } from './plannedStages.ts';

describe('planForOperation', () => {
  it('gives every registered radio a Write plan with unique labels and sane weights', () => {
    for (const d of listRadioDescriptors()) {
      const plan = planForOperation(d, 'write', {});
      expect(plan, d.label).toBeDefined();
      const labels = plan!.map((s) => s.label);
      expect(new Set(labels).size, d.label).toBe(labels.length);
      for (const s of plan!) {
        expect(Number.isFinite(s.weight), `${d.label} ${s.label}`).toBe(true);
        expect(s.weight).toBeGreaterThanOrEqual(0);
      }
      expect(totalPlanWeight(plan!), d.label).toBeGreaterThan(0);
    }
  });

  it('returns undefined when an adapter declares no plan for an operation', () => {
    for (const d of listRadioDescriptors()) {
      expect(planForOperation(d, 'restore', {}), d.label).toBeUndefined();
    }
  });
});

describe('mergeDuplicateStages', () => {
  it('adds weights of a repeated label and keeps the first position', () => {
    const merged = mergeDuplicateStages([
      { label: 'A', weight: 1 },
      { label: 'B', weight: 2, optional: true },
      { label: 'A', weight: 3 },
      { label: 'B', weight: 4, optional: true },
    ]);
    expect(merged).toEqual([
      { label: 'A', weight: 4 },
      { label: 'B', weight: 6, optional: true },
    ]);
  });
});
