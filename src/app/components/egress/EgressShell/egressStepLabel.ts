import type { EgressStep } from './EgressShell.tsx';

/** `"2 of 5 · Read"` — counts only steps whose status is not `skipped`. */
export function egressStepHeaderLabel(steps: readonly EgressStep[]): string {
  const counted = steps.filter((s) => s.status !== 'skipped');
  const m = counted.length;
  const current = steps.find((s) => s.status === 'current' || s.status === 'error');
  if (!current || current.status === 'skipped') {
    const fallback = counted[0];
    return fallback ? `1 of ${m} · ${fallback.label}` : '';
  }
  const n = counted.findIndex((s) => s.id === current.id) + 1;
  return `${n} of ${m} · ${current.label}`;
}