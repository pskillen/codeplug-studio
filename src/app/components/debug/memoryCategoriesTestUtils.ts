import { expect } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';

/** Choose a Memory category in the shared dropdown (option labels may carry a "(count)" suffix). */
export function chooseCategory(name: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Category' }));
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  fireEvent.click(screen.getByRole('option', { name: new RegExp(`^${escaped}( \\(\\d+\\))?$`) }));
}

/**
 * The count in each category's picker label, by category name; `null` where the label has none.
 * Opens the dropdown and closes it again.
 */
export function pickerCounts(): Record<string, number | null> {
  const picker = screen.getByRole('combobox', { name: 'Category' });
  fireEvent.click(picker);
  const counts: Record<string, number | null> = {};
  for (const option of screen.getAllByRole('option')) {
    const match = /^(.*?)(?: \((\d+)\))?$/.exec(option.textContent ?? '');
    counts[match![1]!] = match![2] === undefined ? null : Number(match![2]);
  }
  fireEvent.click(picker);
  return counts;
}

/** The panel's own "N results" line (the table's count before any search). */
function panelResultCount(): number {
  const line = screen.getByText(/^[\d,]+ results?$/);
  return Number((line.textContent ?? '').replace(/[^\d]/g, ''));
}

/**
 * For every category with a count in the picker, choose it and check the count equals the panel's
 * own "N results" before any search. Returns the counts so a test can also pin the expected numbers.
 */
export function expectPickerCountsMatchPanels(): Record<string, number | null> {
  const counts = pickerCounts();
  for (const [name, count] of Object.entries(counts)) {
    if (count === null) continue;
    chooseCategory(name);
    expect(panelResultCount(), `${name} results`).toBe(count);
  }
  return counts;
}
