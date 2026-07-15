import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import type { ComponentProps } from 'react';
import DataTable from './DataTable.tsx';
import { DATATABLE_NAME_SORT_KEY } from '../../lib/dataTable/sort.ts';

interface DemoRow {
  id: string;
  name: string;
  score: number;
}

function makeRows(count: number): DemoRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: String(index + 1),
    name: `Row ${String(index + 1).padStart(3, '0')}`,
    score: index,
  }));
}

function renderTable(
  rows: DemoRow[],
  props: Partial<ComponentProps<typeof DataTable<DemoRow>>> = {},
) {
  return render(
    <MemoryRouter>
      <MantineProvider defaultColorScheme="dark">
        <DataTable
          variant="list"
          rows={rows}
          totalRowCount={rows.length}
          rowKey={(row) => row.id}
          nameColumn={{
            getName: (row) => row.name,
            getPath: (row) => `#${row.id}`,
          }}
          columns={[
            {
              key: 'score',
              header: 'Score',
              render: (row) => row.score,
              sortValue: (row) => row.score,
            },
          ]}
          {...props}
        />
      </MantineProvider>
    </MemoryRouter>,
  );
}

function isScrollViewport(el: Element) {
  return el.getAttribute('data-scrollarea-viewport') === 'true';
}

function mockScrollViewport(height = 400) {
  Element.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
    const viewport = isScrollViewport(this);
    return {
      width: 800,
      height: viewport ? height : 0,
      top: 0,
      left: 0,
      bottom: viewport ? height : 0,
      right: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  });

  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      return isScrollViewport(this) ? height : 0;
    },
  });

  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() {
      return isScrollViewport(this) ? height : 0;
    },
  });
}

describe('DataTable virtualization', () => {
  beforeEach(() => {
    mockScrollViewport();
  });

  it('renders a bounded number of tbody rows when virtualize is true', async () => {
    renderTable(makeRows(200), { virtualize: true });
    const scroll = screen.getByTestId('datatable-scroll');
    expect(scroll).toHaveAttribute('data-virtualized', 'true');

    await waitFor(() => {
      const bodyRows = screen.getAllByTestId('datatable-tbody-row');
      expect(bodyRows.length).toBeGreaterThan(0);
      expect(bodyRows.length).toBeLessThan(80);
    });
  });

  it('does not virtualize below the auto threshold', () => {
    renderTable(makeRows(20), { virtualize: 'auto' });
    const scroll = screen.getByTestId('datatable-scroll');
    expect(scroll).not.toHaveAttribute('data-virtualized');

    expect(screen.getAllByTestId('datatable-tbody-row')).toHaveLength(20);
  });

  it('keeps sort and selection working with virtual rows', async () => {
    const onSelectedKeysChange = vi.fn();
    const { container } = renderTable(makeRows(120), {
      virtualize: true,
      selectable: true,
      selectedKeys: [],
      onSelectedKeysChange,
    });

    fireEvent.click(within(container).getByRole('button', { name: 'Name' }));
    fireEvent.click(within(container).getByRole('button', { name: 'Name' }));

    await waitFor(() => {
      expect(screen.getAllByTestId('datatable-tbody-row').length).toBeGreaterThan(0);
    });

    const firstCheckbox = screen.getAllByRole('checkbox')[1]!;
    fireEvent.click(firstCheckbox);
    expect(onSelectedKeysChange).toHaveBeenCalled();

    const selectAll = screen.getAllByRole('checkbox')[0]!;
    fireEvent.click(selectAll);
    expect(onSelectedKeysChange).toHaveBeenCalledTimes(2);
  });

  it('sorts rows when sort state is descending by name', async () => {
    const rows = makeRows(100);
    const { container } = renderTable(rows, {
      virtualize: true,
      sort: { columnKey: DATATABLE_NAME_SORT_KEY, direction: 'desc' },
    });

    await waitFor(() => {
      const bodyRows = within(container).getAllByTestId('datatable-tbody-row');
      expect(bodyRows[0]).toHaveTextContent('Row 100');
    });
  });
});
