import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { DataTableColumn } from '@app/components/v2/index.ts';
import MemoryCategoryPanel, { identityLabel } from './MemoryCategoryPanel.tsx';

interface Row {
  id: string;
  call?: string;
  name: string;
}
const rows: Row[] = [
  { id: 'a', call: 'GB3XX', name: 'Beta' },
  { id: 'b', name: 'Alpha' },
  { id: 'c', name: 'Gamma' },
];
const columns: DataTableColumn<Row>[] = [
  {
    key: 'identity',
    header: 'Identity',
    sortable: true,
    sortValue: (r) => identityLabel(r.call, r.name),
    render: (r) => identityLabel(r.call, r.name),
  },
];
const caveat = ['line one', 'line two', 'line three'];

const show = (withDetails = true) =>
  render(
    <MantineProvider>
      <MemoryCategoryPanel
        summary="3 things listed"
        caveat={caveat}
        searchPlaceholder="Search things"
        caption="Things"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        searchText={(r) => identityLabel(r.call, r.name)}
        details={withDetails ? (r) => <span>detail for {r.name}</span> : undefined}
      />
    </MantineProvider>,
  );

afterEach(cleanup);

describe('MemoryCategoryPanel', () => {
  it('puts the callsign first, and the name alone when there is none', () => {
    expect(identityLabel('GB3XX', 'Beta')).toBe('GB3XX · Beta');
    expect(identityLabel(' ', 'Alpha')).toBe('Alpha');
    expect(identityLabel(undefined, undefined)).toBe('');
    show();
    expect(screen.getByText('GB3XX · Beta')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('shows the summary and folds the caveat after two lines behind More', () => {
    show();
    expect(screen.getByText('3 things listed')).toBeInTheDocument();
    expect(screen.getByText('line two')).toBeInTheDocument();
    expect(screen.queryByText('line three')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByText('line three')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Less' }));
    expect(screen.queryByText('line three')).not.toBeInTheDocument();
  });

  it('searches callsign as well as name', () => {
    show();
    fireEvent.change(screen.getByPlaceholderText('Search things'), { target: { value: 'gb3' } });
    expect(screen.getByText('GB3XX · Beta')).toBeInTheDocument();
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
  });

  it('opens a details region on row click and closes it on a second click', () => {
    show();
    expect(screen.queryByTestId('memory-row-details')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Alpha'));
    expect(screen.getByText('detail for Alpha')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Alpha'));
    expect(screen.queryByTestId('memory-row-details')).not.toBeInTheDocument();
  });

  it('highlights the selected row and only that row', () => {
    show();
    const rowOf = (text: string) => screen.getByText(text).closest('[role="row"]')!;
    expect(rowOf('Alpha').className).not.toMatch(/rowActive/);
    fireEvent.click(screen.getByText('Alpha'));
    expect(rowOf('Alpha').className).toMatch(/rowActive/);
    expect(rowOf('GB3XX · Beta').className).not.toMatch(/rowActive/);
    fireEvent.click(screen.getByText('Alpha'));
    expect(rowOf('Alpha').className).not.toMatch(/rowActive/);
  });

  it('has no details region without a details prop', () => {
    show(false);
    fireEvent.click(screen.getByText('Alpha'));
    expect(screen.queryByTestId('memory-row-details')).not.toBeInTheDocument();
  });
});
