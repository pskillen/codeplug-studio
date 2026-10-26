import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RANGE_CHANGE_JOURNAL_KEY,
  clearRangeChangeJournal,
  listRangeChangeJournal,
  readRangeChangeJournal,
  upsertRangeChangeJournal,
  type RangeChangeJournalEntry,
} from './rangeChangeJournal.ts';

function entry(over: Partial<RangeChangeJournalEntry> = {}): RangeChangeJournalEntry {
  return {
    serial: 'TESTSERIAL01',
    model: 'AT-D890UV',
    fromCode: 3,
    toCode: 7,
    stage: 'sending',
    backup: {
      fileName: 'radio-backup.zip',
      sha256: 'ab'.repeat(32),
      savedAt: '2026-10-26T14:12:00Z',
    },
    vital: { fileName: 'd890-vital.zip', sha256: 'cd'.repeat(32) },
    startedAt: '2026-10-26T14:10:00Z',
    updatedAt: '2026-10-26T14:14:00Z',
    studioVersion: 'test',
    ...over,
  };
}

describe('rangeChangeJournal', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('round-trips one record per serial and replaces on upsert', () => {
    expect(upsertRangeChangeJournal(entry())).toBe(true);
    expect(upsertRangeChangeJournal(entry({ stage: 'changed' }))).toBe(true);
    expect(listRangeChangeJournal()).toHaveLength(1);
    expect(readRangeChangeJournal('TESTSERIAL01')?.stage).toBe('changed');
    expect(readRangeChangeJournal('OTHER')).toBeUndefined();
    expect(readRangeChangeJournal('  ')).toBeUndefined();
  });

  it('clear removes only that serial', () => {
    upsertRangeChangeJournal(entry());
    upsertRangeChangeJournal(entry({ serial: 'TESTSERIAL02' }));
    clearRangeChangeJournal('TESTSERIAL01');
    expect(listRangeChangeJournal().map((e) => e.serial)).toEqual(['TESTSERIAL02']);
  });

  it('keeps the newest 5 done entries and never prunes an unfinished one', () => {
    upsertRangeChangeJournal(entry({ serial: 'OPEN', stage: 'changed' }));
    for (let i = 0; i < 7; i++) {
      upsertRangeChangeJournal(
        entry({ serial: `DONE${i}`, stage: 'done', updatedAt: `2026-10-2${i}T10:00:00Z` }),
      );
    }
    const serials = listRangeChangeJournal().map((e) => e.serial);
    expect(serials).toContain('OPEN');
    const done = serials.filter((s) => s.startsWith('DONE'));
    expect(done).toHaveLength(5);
    expect(done).not.toContain('DONE0');
    expect(done).not.toContain('DONE1');
  });

  it('stores only the known fields and no bytes', () => {
    upsertRangeChangeJournal({ ...entry(), zipBytes: new Uint8Array(4) } as never);
    const stored = JSON.parse(window.localStorage.getItem(RANGE_CHANGE_JOURNAL_KEY)!)[0];
    expect(Object.keys(stored).sort()).toEqual(
      [
        'backup',
        'fromCode',
        'model',
        'serial',
        'stage',
        'startedAt',
        'studioVersion',
        'toCode',
        'updatedAt',
        'vital',
      ].sort(),
    );
    expect(Object.keys(stored.backup).sort()).toEqual(['fileName', 'savedAt', 'sha256']);
    expect(Object.keys(stored.vital).sort()).toEqual(['fileName', 'sha256']);
  });

  it('a storage that throws on get or set never throws out', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(listRangeChangeJournal()).toEqual([]);
    expect(readRangeChangeJournal('TESTSERIAL01')).toBeUndefined();
    expect(upsertRangeChangeJournal(entry())).toBe(false);
    expect(clearRangeChangeJournal('TESTSERIAL01')).toBe(false);
  });

  it('corrupt JSON, a wrong shape and bad records read as empty', () => {
    window.localStorage.setItem(RANGE_CHANGE_JOURNAL_KEY, '{not json');
    expect(listRangeChangeJournal()).toEqual([]);
    window.localStorage.setItem(RANGE_CHANGE_JOURNAL_KEY, '{"a":1}');
    expect(listRangeChangeJournal()).toEqual([]);
    window.localStorage.setItem(
      RANGE_CHANGE_JOURNAL_KEY,
      JSON.stringify([{ serial: 'X' }, entry({ stage: 'bogus' as never }), entry()]),
    );
    expect(listRangeChangeJournal()).toHaveLength(1);
  });
});
