import { describe, expect, it } from 'vitest';
import { listRadioDescriptors } from './registry.ts';
import { planForOperation, totalPlanWeight } from './plannedStages.ts';

describe('planForOperation', () => {
  it('gives every registered radio a Write plan with sane weights and no adjacent repeats', () => {
    for (const d of listRadioDescriptors()) {
      const plan = planForOperation(d, 'write', {});
      expect(plan, d.label).toBeDefined();
      const labels = plan!.map((s) => s.label);
      // A label may recur only with another stage between (a re-entered stage); back-to-back
      // repeats are one stage with `passes`.
      labels.forEach((l, i) => expect(l, `${d.label} repeats ${l}`).not.toBe(labels[i - 1]));
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
