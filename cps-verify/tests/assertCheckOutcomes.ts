import { expect, it } from 'vitest';
import type { CheckOutcome } from '../src/types.ts';

/** Register one Vitest case per check outcome for Dorny / JUnit granularity. */
export function itEachCheckOutcome(outcomes: CheckOutcome[]): void {
  if (outcomes.length === 0) {
    it('emits at least one check outcome', () => {
      expect(outcomes.length).toBeGreaterThan(0);
    });
    return;
  }

  it.each(
    outcomes.map((o) => ({
      id: o.check.id,
      label: o.check.label,
      ok: o.ok,
      diagnostics: o.diagnostics,
    })),
  )('$id — $label', ({ ok, diagnostics }) => {
    expect(diagnostics, JSON.stringify(diagnostics, null, 2)).toEqual([]);
    expect(ok).toBe(true);
  });
}
