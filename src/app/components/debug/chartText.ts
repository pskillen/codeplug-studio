import type { NumericTableView } from '@integrations/radio-io/debugView';

/** An axis title that always carries its unit: "Drive (PWM counts)"; the label alone when it already says it. */
export function axisTitle(label: string, unit?: string): string {
  if (!unit || label === unit || label.includes(`(${unit})`)) return label;
  return `${label} (${unit})`;
}

/**
 * How many numbers differ between a read's numeric table and the overlay's: columns pair by id, rows by index; a
 * value missing on either side counts as a difference unless missing on both.
 */
export function numericDiffCount(table: NumericTableView, overlay: NumericTableView): number {
  let count = 0;
  const rows = Math.max(table.rows.length, overlay.rows.length);
  const ids = new Set([...table.columns.map((c) => c.id), ...overlay.columns.map((c) => c.id)]);
  for (const id of ids) {
    const a = table.columns.find((c) => c.id === id);
    const b = overlay.columns.find((c) => c.id === id);
    for (let i = 0; i < rows; i++) if (a?.values[i] !== b?.values[i]) count++;
  }
  return count;
}
