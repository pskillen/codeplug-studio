import { diffBytes, type CompareSection } from '@integrations/radio-io/debugCompare/index.ts';
import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { HexDiff } from './HexDiff.tsx';

function section(a: Uint8Array, b: Uint8Array, base = 0): CompareSection {
  return { id: 's', label: 'S', kind: 'compared', base, a, b, ...diffBytes(a, b, base) };
}
const bytes = (n: number, ...changed: Array<[number, number]>) => {
  const out = new Uint8Array(n);
  for (const [at, value] of changed) out[at] = value;
  return out;
};

function Harness(props: {
  section: CompareSection;
  revealed?: boolean;
  masks?: Array<{ start: number; end: number; label: string }>;
  initial?: boolean;
}) {
  const [only, setOnly] = useState(props.initial ?? true);
  return (
    <MantineProvider>
      <HexDiff
        section={props.section}
        rangesA={props.masks ?? []}
        rangesB={props.masks ?? []}
        revealed={props.revealed ?? false}
        onlyChanged={only}
        onOnlyChangedChange={setOnly}
      />
    </MantineProvider>
  );
}
const group = () => screen.getByRole('group', { name: 'Hex diff' });

describe('HexDiff', () => {
  const a = bytes(0x200);
  const b = bytes(0x200, [0x123, 0xff], [0x124, 0x01], [0x1a0, 0x07]);

  it('marks changed bytes, shows the row count, and separates identical rows', () => {
    render(<Harness section={section(a, b)} />);
    const row = group().querySelector('[data-row-address="0x00000120"]')!;
    expect(row.textContent).toContain('2≠');
    const marks = Array.from(row.querySelectorAll('mark')).map((m) => m.textContent);
    expect(marks).toEqual(['00', '00', 'ff', '01']);
    expect(group().textContent).toContain('… 0x00000000–0x0000010F identical (17 rows)');
    expect(group().textContent).toContain('… 0x00000140–0x0000018F identical (5 rows)');
    // Context 1: the rows either side of the changed row come with it.
    expect(group().querySelector('[data-row-address="0x00000110"]')).not.toBeNull();
    expect(group().querySelector('[data-row-address="0x00000100"]')).toBeNull();
  });

  it('shows every row with marks when only changed rows is off', () => {
    render(<Harness section={section(a, b)} initial={false} />);
    expect(group().querySelector('[data-row-address="0x00000000"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(group().querySelectorAll('mark').length).toBeGreaterThan(0);
  });

  it('steps through changes and finds an address', () => {
    render(<Harness section={section(a, b)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next change' }));
    expect(group().querySelector('[aria-current="true"]')?.getAttribute('data-row-address')).toBe(
      '0x00000120',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next change' }));
    expect(group().querySelector('[aria-current="true"]')?.getAttribute('data-row-address')).toBe(
      '0x000001A0',
    );
    expect(screen.getByRole('button', { name: 'Next change' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous change' }));
    expect(group().querySelector('[aria-current="true"]')?.getAttribute('data-row-address')).toBe(
      '0x00000120',
    );
    fireEvent.change(screen.getByLabelText('Go to address'), { target: { value: '0x0010' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(group().querySelector('[aria-current="true"]')?.getAttribute('data-row-address')).toBe(
      '0x00000010',
    );
    fireEvent.change(screen.getByLabelText('Go to address'), { target: { value: '0x9999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(screen.getByText(/Address is outside this region/)).toBeInTheDocument();
  });

  it('keeps masked bytes as •• yet still marks and flags the ones that differ', () => {
    const masks = [{ start: 0x123, end: 0x125, label: 'Password' }];
    const view = render(<Harness section={section(a, b)} masks={masks} />);
    const row = group().querySelector('[data-row-address="0x00000120"]')!;
    expect(row.textContent).not.toMatch(/\b(ff|01)\b/);
    expect(Array.from(row.querySelectorAll('mark')).map((m) => m.textContent)).toEqual([
      '••',
      '••',
      '••',
      '••',
    ]);
    expect(row.textContent).toContain('[masked bytes differ]');
    view.rerender(<Harness section={section(a, b)} masks={masks} revealed />);
    expect(within(group()).getAllByText('ff').length).toBeGreaterThan(0);
    expect(group().textContent).not.toContain('[masked bytes differ]');
  });

  it('says which side has no bytes after the shared length', () => {
    render(<Harness section={section(bytes(32), bytes(48))} initial={false} />);
    expect(group().textContent).toContain('A has no bytes after 0x0000001F');
  });
});
