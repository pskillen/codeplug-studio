import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import type { NumericTableView } from '@integrations/radio-io/debugView';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import NumericTable from './NumericTable.tsx';

const table: NumericTableView = {
  key: { label: 'Index' },
  rows: [{ key: '0', mark: 'reference' }, { key: '1' }],
  columns: [
    { id: 'a', label: 'Drive', width: 1, values: [26, 29], deltaFromRow: 0 },
    { id: 'f', label: 'Freq', width: 1, format: 'decimal', values: [145, undefined] },
  ],
};

const wrap = (ui: ReactNode) => render(<DesignSystemV2Provider>{ui}</DesignSystemV2Provider>);

describe('NumericTable', () => {
  it('builds the table only when opened', () => {
    wrap(<NumericTable table={table} />);
    expect(screen.queryByRole('table')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Numeric table/ }));
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('prints formats, reference mark, delta and not captured', () => {
    wrap(<NumericTable table={table} defaultOpen />);
    expect(screen.getByText('0x1A (26)')).toBeInTheDocument();
    expect(screen.getByText('(ref)')).toBeInTheDocument();
    expect(screen.getByText('Δref +3')).toBeInTheDocument();
    expect(screen.getByText('145')).toBeInTheDocument();
    expect(screen.getByText('Not captured')).toBeInTheDocument();
  });

  it('shows overlay value and Δread', () => {
    const overlay: NumericTableView = {
      ...table,
      columns: [{ ...table.columns[0], values: [26, 31] }, table.columns[1]],
    };
    wrap(<NumericTable table={table} overlay={overlay} overlayLabel="B" defaultOpen />);
    expect(screen.getByText(/B: 0x1F \(31\) · Δread \+2/)).toBeInTheDocument();
  });
});
