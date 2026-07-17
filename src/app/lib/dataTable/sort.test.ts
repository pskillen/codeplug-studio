import { describe, expect, it } from 'vitest';
import {
  DATATABLE_NAME_SORT_KEY,
  DATATABLE_STORED_ORDER_SORT_KEY,
  isStoredOrderSort,
  nextSortState,
  sortDataTableRows,
} from './sort.ts';

interface Row {
  id: string;
  name: string;
  count: number;
}

const rows: Row[] = [
  { id: '1', name: 'Zulu', count: 10 },
  { id: '2', name: 'Alpha', count: 3 },
  { id: '3', name: 'Mike', count: 7 },
];

const ctx = {
  columns: [{ key: 'count', header: 'Count', render: () => null, sortValue: (r: Row) => r.count }],
  nameColumn: {
    getName: (r: Row) => r.name,
    getPath: (r: Row) => `/items/${r.id}`,
  },
};

describe('sortDataTableRows', () => {
  it('sorts by name locale-aware ascending', () => {
    const sorted = sortDataTableRows(
      rows,
      { columnKey: DATATABLE_NAME_SORT_KEY, direction: 'asc' },
      ctx,
    );
    expect(sorted.map((r) => r.name)).toEqual(['Alpha', 'Mike', 'Zulu']);
  });

  it('sorts numeric columns descending', () => {
    const sorted = sortDataTableRows(rows, { columnKey: 'count', direction: 'desc' }, ctx);
    expect(sorted.map((r) => r.count)).toEqual([10, 7, 3]);
  });

  it('returns rows unchanged when sort state is null', () => {
    expect(sortDataTableRows(rows, null, ctx)).toEqual(rows);
  });

  it('keeps rows order for stored-order asc and reverses for desc', () => {
    const storedCtx = { ...ctx, storedOrderColumnKey: DATATABLE_STORED_ORDER_SORT_KEY };
    const asc = sortDataTableRows(
      rows,
      { columnKey: DATATABLE_STORED_ORDER_SORT_KEY, direction: 'asc' },
      storedCtx,
    );
    expect(asc.map((r) => r.id)).toEqual(['1', '2', '3']);
    const desc = sortDataTableRows(
      rows,
      { columnKey: DATATABLE_STORED_ORDER_SORT_KEY, direction: 'desc' },
      storedCtx,
    );
    expect(desc.map((r) => r.id)).toEqual(['3', '2', '1']);
  });
});

describe('isStoredOrderSort', () => {
  it('treats null sort as stored when a key is configured', () => {
    expect(isStoredOrderSort(null, 'exportOrder')).toBe(true);
  });

  it('matches the configured column key', () => {
    expect(isStoredOrderSort({ columnKey: 'exportOrder', direction: 'asc' }, 'exportOrder')).toBe(
      true,
    );
    expect(
      isStoredOrderSort({ columnKey: DATATABLE_NAME_SORT_KEY, direction: 'asc' }, 'exportOrder'),
    ).toBe(false);
  });
});

describe('nextSortState', () => {
  it('starts ascending on new column', () => {
    expect(nextSortState(null, 'count')).toEqual({ columnKey: 'count', direction: 'asc' });
  });

  it('toggles direction on same column', () => {
    expect(nextSortState({ columnKey: 'count', direction: 'asc' }, 'count')).toEqual({
      columnKey: 'count',
      direction: 'desc',
    });
  });
});
