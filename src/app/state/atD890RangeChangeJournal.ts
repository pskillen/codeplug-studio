/**
 * Thin React binding over the range-change journal port (Danger zone, #1369). The port is `localStorage`; this
 * adds a subscription so the banner, the area footer and the wizard re-render when a record changes in this tab,
 * and re-read when another tab changes it. The state is the port itself: nothing is cached here.
 */

import { useSyncExternalStore } from 'react';
import {
  clearRangeChangeJournal,
  listRangeChangeJournal,
  RANGE_CHANGE_JOURNAL_KEY,
  readRangeChangeJournal,
  upsertRangeChangeJournal,
  type RangeChangeJournalEntry,
} from '@integrations/persistence/rangeChangeJournal.ts';

const listeners = new Set<() => void>();
let version = 0;
let cache: { version: number; entries: readonly RangeChangeJournalEntry[] } | null = null;

function emit(): void {
  version += 1;
  cache = null;
  for (const l of listeners) l();
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === null || e.key === RANGE_CHANGE_JOURNAL_KEY) emit();
  });
}

export function subscribeRangeChangeJournal(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Every record (stable between changes). */
export function getRangeChangeJournal(): readonly RangeChangeJournalEntry[] {
  if (!cache || cache.version !== version) cache = { version, entries: listRangeChangeJournal() };
  return cache.entries;
}

export function getRangeChangeJournalEntry(serial: string): RangeChangeJournalEntry | undefined {
  return readRangeChangeJournal(serial);
}

export function saveRangeChangeJournalEntry(entry: RangeChangeJournalEntry): boolean {
  const ok = upsertRangeChangeJournal(entry);
  emit();
  return ok;
}

export function removeRangeChangeJournalEntry(serial: string): void {
  clearRangeChangeJournal(serial);
  emit();
}

/** Entries that need the user: the radio may be wiped, or restored but not checked. */
export function unfinishedRangeChanges(
  entries: readonly RangeChangeJournalEntry[],
): RangeChangeJournalEntry[] {
  return entries.filter((e) => e.stage !== 'done');
}

/** The newest `done` entry, for the area's "Last change" line. */
export function lastDoneRangeChange(
  entries: readonly RangeChangeJournalEntry[],
): RangeChangeJournalEntry | undefined {
  return entries
    .filter((e) => e.stage === 'done')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

export function useRangeChangeJournal(): readonly RangeChangeJournalEntry[] {
  return useSyncExternalStore(subscribeRangeChangeJournal, getRangeChangeJournal, () => []);
}

/** Tests only: drop the cache so the next read hits storage. */
export function resetRangeChangeJournalCache(): void {
  emit();
}
