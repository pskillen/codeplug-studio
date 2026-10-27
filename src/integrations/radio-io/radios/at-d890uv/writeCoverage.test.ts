import { describe, expect, it } from 'vitest';
import { atD890WriteCoverageRows } from './writeCoverage.ts';

const settingsRow = (n?: number) =>
  atD890WriteCoverageRows(false, n).find((r) => r.label === 'Radio settings')!;

describe('What Write updates: the Radio settings row', () => {
  it('is preserved with no note until the user sets fields', () => {
    expect(settingsRow().status).toBe('preserved');
    expect(settingsRow().note).toBeUndefined();
    expect(settingsRow(0).note).toBeUndefined();
  });

  it('says how many fields the session sets', () => {
    expect(settingsRow(1).note).toBe('Preserved, except 1 field you set');
    expect(settingsRow(5).note).toBe('Preserved, except 5 fields you set');
    expect(atD890WriteCoverageRows(true, 2).find((r) => r.label === 'Radio settings')?.note).toBe(
      'Preserved, except 2 fields you set',
    );
  });
});

describe('What Write updates: the NXDN channel settings row', () => {
  const nxdnRow = (mm9pdy: boolean) =>
    atD890WriteCoverageRows(mm9pdy).find((r) => r.label === 'NXDN channel settings')!;

  it('is written on MM9PDY, with the radio condition in the note', () => {
    expect(nxdnRow(true).status).toBe('written');
    expect(nxdnRow(true).note).toMatch(/reports NXDN enabled/);
    expect(nxdnRow(true).note).toMatch(/Reset Digital Protocol is then set to Off/);
  });

  it('is carried through unchanged on the stock target', () => {
    expect(nxdnRow(false).status).toBe('preserved');
    expect(nxdnRow(false).note).toBeUndefined();
  });
});

describe('What Write updates: the NXDN list rows', () => {
  const labels = ['NXDN talk groups and contacts', 'NXDN RX group lists'];
  const row = (mm9pdy: boolean, label: string) =>
    atD890WriteCoverageRows(mm9pdy).find((r) => r.label === label)!;

  it('are written on MM9PDY when the radio reports NXDN enabled', () => {
    for (const label of labels) {
      expect(row(true, label).status).toBe('written');
      expect(row(true, label).note).toMatch(/reports NXDN enabled/);
    }
  });

  it('are left alone on the stock target', () => {
    for (const label of labels) {
      expect(row(false, label).status).toBe('leftAlone');
      expect(row(false, label).note).toBeUndefined();
    }
  });
});

describe('What Write updates: the NXDN ID row (#1442)', () => {
  const row = (mm9pdy: boolean, hasDefaultNxdnId: boolean) =>
    atD890WriteCoverageRows(mm9pdy, 0, false, hasDefaultNxdnId).find((r) => r.label === 'NXDN ID')!;

  it('is written on MM9PDY from the default NXDN ID, when the radio has NXDN enabled', () => {
    expect(row(true, true).status).toBe('written');
    expect(row(true, true).note).toBe('From your default NXDN ID, when the radio has NXDN enabled');
  });

  it('is left alone on MM9PDY without a default NXDN ID', () => {
    expect(row(true, false).status).toBe('leftAlone');
    expect(row(true, false).note).toBe('No default NXDN ID');
  });

  it('is left alone on the stock target, default or not', () => {
    for (const hasDefault of [true, false]) {
      expect(row(false, hasDefault).status).toBe('leftAlone');
      expect(row(false, hasDefault).note).toBeUndefined();
    }
  });
});
