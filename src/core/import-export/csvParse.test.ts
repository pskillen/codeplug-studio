import { describe, expect, it } from 'vitest';
import { csvToTable, parseCsv } from './csvParse.ts';

describe('parseCsv', () => {
  it('parses quoted fields with commas', () => {
    expect(parseCsv('a,"b,c",d\n1,2,3')).toEqual([
      ['a', 'b,c', 'd'],
      ['1', '2', '3'],
    ]);
  });

  it('parses escaped double quotes', () => {
    expect(parseCsv('"say ""hi""",x')).toEqual([['say "hi"', 'x']]);
  });
});

describe('csvToTable', () => {
  it('uses first row as headers', () => {
    expect(csvToTable('Name,Freq\nCh1,145.0')).toEqual({
      headers: ['Name', 'Freq'],
      rows: [['Ch1', '145.0']],
    });
  });

  it('strips BOM', () => {
    expect(csvToTable('\uFEFFCol\nval')).toEqual({
      headers: ['Col'],
      rows: [['val']],
    });
  });

  it('returns header-only table when no data rows', () => {
    expect(csvToTable('A,B,C')).toEqual({
      headers: ['A', 'B', 'C'],
      rows: [],
    });
  });

  it('returns empty table for blank input', () => {
    expect(csvToTable('')).toEqual({ headers: [], rows: [] });
    expect(csvToTable('   \n  ')).toEqual({ headers: [], rows: [] });
  });
});
