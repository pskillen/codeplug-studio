import { describe, expect, it } from 'vitest';
import { DANGER_ZONE_DECISIONS } from './decisions.ts';

describe('DANGER_ZONE_DECISIONS', () => {
  it('pins the nine owner decisions of 2026-10-26', () => {
    expect(DANGER_ZONE_DECISIONS).toEqual({
      areaName: 'Danger zone', // Q1
      strap: "These change the radio itself. A Write can't undo them.", // Q1
      confirmStyle: 'checkbox-and-button', // Q2
      showNarrowerRangesToggle: false, // Q3
      code14: 'listed-disabled-without-890', // Q4
      backupCheck: 'tickbox', // Q5
      backupCheckLabel: "I've saved both files", // Q5
      restoreAnywayBehindSecondConfirm: true, // Q6
      // Q7 (no prod gate) is the absence of any gate: see gate.test.ts and registry.test.ts.
      unlistedCodes: { codes: [6, 9, 12, 15], policy: 'allow-with-scary-warning' }, // Q8
      finalCheckAutomatic: false, // Q9
      restartCountdownSeconds: 60, // RT-2
      programErrorAdvice: 'stay-connected', // RT-8
    });
  });
});
