import { describe, expect, it } from 'vitest';
import { DATATABLE_NAME_SORT_KEY, nextSortState, sortDataTableRows } from './sort.ts';

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
