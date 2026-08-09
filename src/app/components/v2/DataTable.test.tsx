import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DataTable, { type DataTableColumn } from './DataTable.tsx';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';

function mockMobileViewport() {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: true,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

interface Row {
  id: string;
  name: string;
  score: number;
}

const ROWS: Row[] = [
  { id: '1', name: 'Bravo', score: 20 },
  { id: '2', name: 'Alpha', score: 5 },
  { id: '3', name: 'Charlie', score: 12 },
];

const COLUMNS: DataTableColumn<Row>[] = [
  {
    key: 'name',
    header: 'Name',
    render: (row) => row.name,
    sortable: true,
    sortValue: (row) => row.name,
  },
  {
    key: 'score',
    header: 'Score',
    render: (row) => row.score,
    sortable: true,
    sortValue: (row) => row.score,
  },
];

describe('DataTable v2', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders every row and column', () => {
    render(
      <DesignSystemV2Provider>
        <DataTable columns={COLUMNS} rows={ROWS} getRowId={(row) => row.id} />
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('Bravo')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('sorts by column on header click, ascending then descending then unsorted', () => {
    render(
      <DesignSystemV2Provider>
        <DataTable columns={COLUMNS} rows={ROWS} getRowId={(row) => row.id} />
      </DesignSystemV2Provider>,
    );

    const rowsInOrder = () =>
      screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent);

    fireEvent.click(screen.getByRole('button', { name: /Name/ }));
    expect(rowsInOrder()[0]).toContain('Alpha');

    fireEvent.click(screen.getByRole('button', { name: /Name/ }));
    expect(rowsInOrder()[0]).toContain('Charlie');

    fireEvent.click(screen.getByRole('button', { name: /Name/ }));
    // Unsorted falls back to original row order (Bravo first).
    expect(rowsInOrder()[0]).toContain('Bravo');
  });

  it('shows the search input and calls onChange', () => {
    const onChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <DataTable
          columns={COLUMNS}
          rows={ROWS}
          getRowId={(row) => row.id}
          search={{ value: '', onChange }}
        />
      </DesignSystemV2Provider>,
    );

    fireEvent.change(screen.getByLabelText('Search table'), { target: { value: 'alp' } });
    expect(onChange).toHaveBeenCalledWith('alp');
  });

  it('shows "Showing N of M" when resultCount differs from totalRowCount', () => {
    render(
      <DesignSystemV2Provider>
        <DataTable
          columns={COLUMNS}
          rows={ROWS}
          getRowId={(row) => row.id}
          resultCount={3}
          totalRowCount={10}
        />
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('Showing 3 of 10')).toBeInTheDocument();
  });

  it('shows filteredEmptyMessage instead of emptyMessage when rows are empty but totalRowCount > 0', () => {
    render(
      <DesignSystemV2Provider>
        <DataTable
          columns={COLUMNS}
          rows={[]}
          getRowId={(row) => row.id}
          totalRowCount={5}
          emptyMessage="Nothing here"
          filteredEmptyMessage="No matches for that filter"
        />
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('No matches for that filter')).toBeInTheDocument();
    expect(screen.queryByText('Nothing here')).not.toBeInTheDocument();
  });

  it('shows emptyMessage when there are no rows and no totalRowCount', () => {
    render(
      <DesignSystemV2Provider>
        <DataTable
          columns={COLUMNS}
          rows={[]}
          getRowId={(row) => row.id}
          emptyMessage="Nothing here"
        />
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('toggles row selection and calls onSelectionChange', () => {
    const onSelectionChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <DataTable
          columns={COLUMNS}
          rows={ROWS}
          getRowId={(row) => row.id}
          selectable
          selectedKeys={[]}
          onSelectionChange={onSelectionChange}
        />
      </DesignSystemV2Provider>,
    );

    fireEvent.click(screen.getByLabelText('Select row 1'));
    expect(onSelectionChange).toHaveBeenCalledWith(['1']);
  });

  it('excludes non-selectable rows from select-all and gates their checkbox', () => {
    const onSelectionChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <DataTable
          columns={COLUMNS}
          rows={ROWS}
          getRowId={(row) => row.id}
          selectable
          selectedKeys={[]}
          onSelectionChange={onSelectionChange}
          isRowSelectable={(row) => row.id !== '2'}
        />
      </DesignSystemV2Provider>,
    );

    expect(screen.queryByLabelText('Select row 2')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Select all rows'));
    expect(onSelectionChange).toHaveBeenCalledWith(expect.arrayContaining(['1', '3']));
    expect(onSelectionChange.mock.calls[0][0]).not.toContain('2');
  });

  it('shows the selection toolbar with bulk actions and a clear control once rows are selected', () => {
    const onClearSelection = vi.fn();
    render(
      <DesignSystemV2Provider>
        <DataTable
          columns={COLUMNS}
          rows={ROWS}
          getRowId={(row) => row.id}
          selectable
          selectedKeys={['1']}
          onSelectionChange={() => undefined}
          onClearSelection={onClearSelection}
          bulkActions={<button type="button">Delete selected</button>}
        />
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete selected' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClearSelection).toHaveBeenCalled();
  });

  it('reorderMode disables column sort and displays rows in given order', () => {
    render(
      <DesignSystemV2Provider>
        <DataTable columns={COLUMNS} rows={ROWS} getRowId={(row) => row.id} reorderMode />
      </DesignSystemV2Provider>,
    );

    // Sort buttons are gone — headers render as plain text under reorderMode.
    expect(screen.queryByRole('button', { name: /Name/ })).not.toBeInTheDocument();
    const rowsInOrder = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.textContent);
    expect(rowsInOrder[0]).toContain('Bravo');
  });

  it('shows an interactive drag handle per row (not up/down buttons) when onReorder is provided', () => {
    render(
      <DesignSystemV2Provider>
        <DataTable
          columns={COLUMNS}
          rows={ROWS}
          getRowId={(row) => row.id}
          reorderMode
          onReorder={() => undefined}
        />
      </DesignSystemV2Provider>,
    );

    expect(screen.getAllByRole('button', { name: 'Drag to reorder' })).toHaveLength(ROWS.length);
    expect(screen.queryByRole('button', { name: /Move row/ })).not.toBeInTheDocument();
  });

  it('drag handle is static (non-interactive) when onReorder is not provided', () => {
    render(
      <DesignSystemV2Provider>
        <DataTable columns={COLUMNS} rows={ROWS} getRowId={(row) => row.id} reorderMode />
      </DesignSystemV2Provider>,
    );

    expect(screen.queryByRole('button', { name: 'Drag to reorder' })).not.toBeInTheDocument();
  });

  it('bulkReorder toolbar Move up applies to all selected rows', () => {
    const onReorder = vi.fn();
    render(
      <DesignSystemV2Provider>
        <DataTable
          columns={COLUMNS}
          rows={ROWS}
          getRowId={(row) => row.id}
          selectable
          selectedKeys={['3']}
          onSelectionChange={() => undefined}
          reorderMode
          bulkReorder
          onReorder={onReorder}
        />
      </DesignSystemV2Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Move selected up' }));
    expect(onReorder).toHaveBeenCalledWith([ROWS[0], ROWS[2], ROWS[1]]);
  });

  it('row activate calls onRowActivate for a selectable row and not for a gated row', () => {
    const onRowActivate = vi.fn();
    render(
      <DesignSystemV2Provider>
        <DataTable
          columns={COLUMNS}
          rows={ROWS}
          getRowId={(row) => row.id}
          selectable
          isRowSelectable={(row) => row.id !== '2'}
          onRowActivate={onRowActivate}
        />
      </DesignSystemV2Provider>,
    );

    fireEvent.click(screen.getAllByRole('row')[1]!);
    expect(onRowActivate).toHaveBeenCalledWith(ROWS[0]);

    onRowActivate.mockClear();
    fireEvent.click(screen.getAllByRole('row')[2]!);
    expect(onRowActivate).not.toHaveBeenCalled();
  });

  it('getRowVariant("nestParent") applies the quiet-background row class', () => {
    render(
      <DesignSystemV2Provider>
        <DataTable
          columns={COLUMNS}
          rows={ROWS}
          getRowId={(row) => row.id}
          getRowVariant={(row) => (row.id === '1' ? 'nestParent' : undefined)}
        />
      </DesignSystemV2Provider>,
    );

    expect(screen.getAllByRole('row')[1]!.className).toMatch(/rowNestParent/);
    expect(screen.getAllByRole('row')[2]!.className).not.toMatch(/rowNestParent/);
  });

  it('nested rows expand to show children and collapse again', () => {
    const parentRows = [{ id: 'p1', name: 'Zone A', score: 0 }];
    const children: Record<string, Row[]> = {
      p1: [{ id: 'c1', name: 'Channel 1', score: 0 }],
    };
    render(
      <DesignSystemV2Provider>
        <DataTable
          columns={COLUMNS}
          rows={parentRows}
          getRowId={(row) => row.id}
          nested
          getChildren={(row) => children[row.id]}
        />
      </DesignSystemV2Provider>,
    );

    expect(screen.queryByText('Channel 1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand row' }));
    expect(screen.getByText('Channel 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse row' }));
    expect(screen.queryByText('Channel 1')).not.toBeInTheDocument();
  });

  it('shows a column-visibility popover for hideable columns and hides a column when unchecked', () => {
    const columnsWithHideable: DataTableColumn<Row>[] = [
      ...COLUMNS,
      { key: 'extra', header: 'Extra', render: () => 'x', hideable: true },
    ];
    render(
      <DesignSystemV2Provider>
        <DataTable columns={columnsWithHideable} rows={ROWS} getRowId={(row) => row.id} />
      </DesignSystemV2Provider>,
    );

    expect(screen.getAllByText('Extra').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Show/hide cols' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Extra' }));
    expect(screen.queryByRole('columnheader', { name: 'Extra' })).not.toBeInTheDocument();
  });

  it('applies the extreme scale data attribute for sticky-header dense tables', () => {
    render(
      <DesignSystemV2Provider>
        <DataTable columns={COLUMNS} rows={ROWS} getRowId={(row) => row.id} scale="extreme" />
      </DesignSystemV2Provider>,
    );

    expect(screen.getByRole('table')).toHaveAttribute('data-scale', 'extreme');
  });

  it('uses a minmax floor for flexible columns so wide tables can scroll horizontally', () => {
    render(
      <DesignSystemV2Provider>
        <DataTable columns={COLUMNS} rows={ROWS} getRowId={(row) => row.id} />
      </DesignSystemV2Provider>,
    );

    expect(screen.getAllByRole('row')[0]).toHaveStyle({
      gridTemplateColumns: 'minmax(8rem, 1fr) minmax(8rem, 1fr)',
    });
  });

  it('renders mobileCard instead of column cells on a mobile viewport', () => {
    mockMobileViewport();
    render(
      <DesignSystemV2Provider>
        <DataTable
          columns={COLUMNS}
          rows={ROWS}
          getRowId={(row) => row.id}
          mobileCard={(row) => <div>Card: {row.name}</div>}
        />
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('Card: Bravo')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Name' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Score' })).not.toBeInTheDocument();
  });

  it('ignores mobileCard on a desktop viewport, rendering normal columns', () => {
    render(
      <DesignSystemV2Provider>
        <DataTable
          columns={COLUMNS}
          rows={ROWS}
          getRowId={(row) => row.id}
          mobileCard={(row) => <div>Card: {row.name}</div>}
        />
      </DesignSystemV2Provider>,
    );

    expect(screen.queryByText('Card: Bravo')).not.toBeInTheDocument();
    expect(screen.getByText('Bravo')).toBeInTheDocument();
  });

  it('hides selection checkboxes but keeps row activation working with mobileCard on a mobile viewport', () => {
    mockMobileViewport();
    const onSelectionChange = vi.fn();
    const onRowActivate = vi.fn();
    render(
      <DesignSystemV2Provider>
        <DataTable
          columns={COLUMNS}
          rows={ROWS}
          getRowId={(row) => row.id}
          selectable
          selectedKeys={[]}
          onSelectionChange={onSelectionChange}
          onRowActivate={onRowActivate}
          mobileCard={(row) => <div>Card: {row.name}</div>}
        />
      </DesignSystemV2Provider>,
    );

    expect(screen.queryByLabelText('Select row 1')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Select all rows')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Card: Bravo'));
    expect(onRowActivate).toHaveBeenCalledWith(ROWS[0]);
  });
});
