import { describe, expect, it } from 'vitest';
import { filterCsvRows, projectCsvTableRows, sortCsvRows } from './csvPreviewTable.ts';

const rows = [
  ['Alpha', '145.000'],
  ['Bravo', '430.000'],
  ['Charlie', '145.625'],
];

describe('filterCsvRows', () => {
  it('filters by case-insensitive substring per column', () => {
    expect(filterCsvRows(rows, ['', '145'])).toEqual([
      ['Alpha', '145.000'],
      ['Charlie', '145.625'],
    ]);
  });

  it('ANDs filters across columns', () => {
    expect(filterCsvRows(rows, ['', '430'])).toEqual([['Bravo', '430.000']]);
  });
});

describe('sortCsvRows', () => {
  it('sorts ascending by column index', () => {
    expect(sortCsvRows(rows, { columnIndex: 0, direction: 'asc' }).map((r) => r[0])).toEqual([
      'Alpha',
      'Bravo',
      'Charlie',
    ]);
  });

  it('sorts descending by column index', () => {
    expect(sortCsvRows(rows, { columnIndex: 0, direction: 'desc' }).map((r) => r[0])).toEqual([
      'Charlie',
      'Bravo',
      'Alpha',
    ]);
  });
});

describe('projectCsvTableRows', () => {
  it('filters then sorts', () => {
    expect(
      projectCsvTableRows(rows, ['', '145'], { columnIndex: 0, direction: 'desc' }).map(
        (r) => r[0],
      ),
    ).toEqual(['Charlie', 'Alpha']);
  });
});
