import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RangeChangeJournalEntry } from '@integrations/persistence/rangeChangeJournal.ts';
import {
  getRangeChangeJournal,
  lastDoneRangeChange,
  removeRangeChangeJournalEntry,
  resetRangeChangeJournalCache,
  saveRangeChangeJournalEntry,
  subscribeRangeChangeJournal,
  unfinishedRangeChanges,
} from './atD890RangeChangeJournal.ts';

function entry(over: Partial<RangeChangeJournalEntry> = {}): RangeChangeJournalEntry {
  return {
    serial: 'TESTSERIAL01',
    model: 'AT-D890UV',
    fromCode: 3,
    toCode: 7,
    stage: 'changed',
    backup: { fileName: 'b.zip', sha256: 'a'.repeat(64), savedAt: '2026-10-26T14:12:00Z' },
    vital: { fileName: 'v.zip', sha256: 'b'.repeat(64) },
    startedAt: '2026-10-26T14:10:00Z',
    updatedAt: '2026-10-26T14:14:00Z',
    studioVersion: 'test',
    ...over,
  };
}

describe('atD890RangeChangeJournal state', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetRangeChangeJournalCache();
  });
  afterEach(() => vi.restoreAllMocks());

  it('notifies subscribers on save and remove, and returns a stable list between changes', () => {
    const seen = vi.fn();
    const off = subscribeRangeChangeJournal(seen);
    saveRangeChangeJournalEntry(entry());
    expect(seen).toHaveBeenCalledTimes(1);
    expect(getRangeChangeJournal()).toBe(getRangeChangeJournal());
    expect(getRangeChangeJournal()).toHaveLength(1);
    removeRangeChangeJournalEntry('TESTSERIAL01');
    expect(seen).toHaveBeenCalledTimes(2);
    expect(getRangeChangeJournal()).toHaveLength(0);
    off();
  });

  it('splits unfinished from done and finds the newest done', () => {
    saveRangeChangeJournalEntry(entry({ serial: 'A', stage: 'sending' }));
    saveRangeChangeJournalEntry(
      entry({ serial: 'B', stage: 'done', updatedAt: '2026-10-25T10:00:00Z' }),
    );
    saveRangeChangeJournalEntry(
      entry({ serial: 'C', stage: 'done', updatedAt: '2026-10-26T10:00:00Z' }),
    );
    const all = getRangeChangeJournal();
    expect(unfinishedRangeChanges(all).map((e) => e.serial)).toEqual(['A']);
    expect(lastDoneRangeChange(all)?.serial).toBe('C');
  });
});
