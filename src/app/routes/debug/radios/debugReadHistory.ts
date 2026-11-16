import { useSyncExternalStore } from 'react';
import { getRadioDescriptor } from '@integrations/radio-io/registry.ts';
import type { RadioBackupLabels } from '@integrations/radio-io/backup/index.ts';
import { relabelDebugArchive, type DebugArchive } from './captureArchive.ts';
import type { RadioDebugDescriptor } from './descriptors.ts';

export type HistoryKey = string;
export interface DebugHistoryEntry {
  readonly id: string;
  readonly label: string;
  readonly readAt: string;
  readonly archive: DebugArchive;
}
/** The two reads the Compare tab shows; each side is a retained id, or null while there are too few reads. */
export interface DebugComparePair {
  readonly a: string | null;
  readonly b: string | null;
}
export interface DebugHistorySnapshot {
  readonly entries: readonly DebugHistoryEntry[];
  readonly selectedId: string | null;
  /** Second retained read for comparison and calibration overlay; always a retained id or null. */
  readonly compareId: string | null;
  /**
   * The Compare tab's pair, apart from the calibration overlay pick. A side with no explicit pick is
   * the previous read (A) or the latest read (B); an explicit pick stays through new reads until its
   * read leaves the history, then that side falls back to the default.
   */
  readonly comparePair: DebugComparePair;
  readonly undownloaded: number;
}
export interface DebugReadHistoryStore {
  getSnapshot(): DebugHistorySnapshot;
  subscribe(listener: () => void): () => void;
  add(archive: DebugArchive): DebugHistoryEntry;
  importArchives(archives: readonly DebugArchive[]): readonly DebugHistoryEntry[];
  select(id: string): void;
  /** Choose the comparison / overlay read by retained id; unknown ids clear it. */
  setCompare(id: string | null): void;
  /** Pick the Compare tab's A and/or B by retained id; an omitted side is unchanged, null or an unknown id restores that side's default. */
  setComparePair(pair: { a?: string | null; b?: string | null }): void;
  /** Exchange A and B (both become explicit picks). */
  swapComparePair(): void;
  /** Drop both explicit picks: back to previous vs latest. */
  clearComparePair(): void;
  /**
   * Replace a retained read's radio name, label and description. Descriptive only. A live read
   * counts as not downloaded again, because the saved zip would differ.
   */
  setLabels(id: string, labels: RadioBackupLabels): void;
  markDownloaded(ids: readonly string[]): void;
  clear(): void;
}

type Descriptor = Pick<RadioDebugDescriptor, 'slug' | 'archiveModelId'>;
const stores = new Map<HistoryKey, { model: string; store: DebugReadHistoryStore }>();
let nextId = 0;

function label(index: number): string {
  let n = index;
  let result = '';
  do {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return result;
}

function resolvePair(
  entries: readonly DebugHistoryEntry[],
  picks: { a: string | null; b: string | null },
): DebugComparePair {
  const has = (id: string | null) => id !== null && entries.some((entry) => entry.id === id);
  return {
    a: has(picks.a) ? picks.a : (entries[entries.length - 2]?.id ?? null),
    b: has(picks.b) ? picks.b : (entries[entries.length - 1]?.id ?? null),
  };
}

function createStore(descriptor: Descriptor): DebugReadHistoryStore {
  let picks: { a: string | null; b: string | null } = { a: null, b: null };
  let snapshot: DebugHistorySnapshot = {
    entries: [],
    selectedId: null,
    compareId: null,
    comparePair: { a: null, b: null },
    undownloaded: 0,
  };
  const pending = new Set<string>();
  const listeners = new Set<() => void>();
  const emit = (
    entries = snapshot.entries,
    selectedId = snapshot.selectedId,
    compareId = snapshot.compareId,
  ) => {
    const resolved = resolvePair(entries, picks);
    const comparePair =
      resolved.a === snapshot.comparePair.a && resolved.b === snapshot.comparePair.b
        ? snapshot.comparePair
        : resolved;
    snapshot = { entries, selectedId, compareId, comparePair, undownloaded: pending.size };
    listeners.forEach((listener) => listener());
  };
  const validate = (archive: DebugArchive) => {
    if (
      !getRadioDescriptor(descriptor.archiveModelId)?.modelIds.includes(
        archive.manifest.radioModelId,
      )
    )
      throw new Error(
        `Archive model ${archive.manifest.radioModelId} does not match this profile.`,
      );
    if (!Number.isFinite(Date.parse(archive.manifest.capturedAt)))
      throw new Error('Invalid capture time.');
  };
  const append = (archives: readonly DebugArchive[], imported: boolean) => {
    archives.forEach(validate);
    const entries = archives.map((archive, index): DebugHistoryEntry => ({
      id: String(++nextId),
      label: label(snapshot.entries.length + index),
      readAt: archive.manifest.capturedAt,
      archive: imported ? { ...archive, source: 'file' } : archive,
    }));
    if (!imported) entries.forEach((entry) => pending.add(entry.id));
    if (entries.length) emit([...snapshot.entries, ...entries], entries[entries.length - 1]!.id);
    return entries;
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    add(archive) {
      if (archive.source !== 'live-read') throw new Error('Expected a live capture.');
      return append([archive], false)[0]!;
    },
    importArchives: (archives) => append(archives, true),
    select(id) {
      if (snapshot.selectedId !== id && snapshot.entries.some((entry) => entry.id === id))
        emit(snapshot.entries, id);
    },
    setCompare(id) {
      const next = id !== null && snapshot.entries.some((entry) => entry.id === id) ? id : null;
      if (next !== snapshot.compareId) emit(snapshot.entries, snapshot.selectedId, next);
    },
    setComparePair(pair) {
      const known = (id: string | null | undefined) =>
        id != null && snapshot.entries.some((entry) => entry.id === id) ? id : null;
      const next = {
        a: pair.a === undefined ? picks.a : known(pair.a),
        b: pair.b === undefined ? picks.b : known(pair.b),
      };
      if (next.a === picks.a && next.b === picks.b) return;
      picks = next;
      emit();
    },
    swapComparePair() {
      const { a, b } = snapshot.comparePair;
      if (a === null || b === null) return;
      picks = { a: b, b: a };
      emit();
    },
    clearComparePair() {
      if (picks.a === null && picks.b === null) return;
      picks = { a: null, b: null };
      emit();
    },
    setLabels(id, labels) {
      const entry = snapshot.entries.find((item) => item.id === id);
      if (!entry) return;
      const archive = relabelDebugArchive(entry.archive, labels);
      if (archive.source === 'live-read') pending.add(id);
      emit(snapshot.entries.map((item) => (item.id === id ? { ...item, archive } : item)));
    },
    markDownloaded(ids) {
      let changed = false;
      ids.forEach((id) => {
        changed = pending.delete(id) || changed;
      });
      if (changed) emit();
    },
    clear() {
      pending.clear();
      picks = { a: null, b: null };
      emit([], null, null);
    },
  };
}

export function getDebugReadHistory(descriptor: Descriptor): DebugReadHistoryStore {
  const existing = stores.get(descriptor.slug);
  if (existing) {
    if (existing.model !== descriptor.archiveModelId)
      throw new Error('History descriptor mismatch.');
    return existing.store;
  }
  const store = createStore(descriptor);
  stores.set(descriptor.slug, { model: descriptor.archiveModelId, store });
  return store;
}

export function useDebugReadHistory(store: DebugReadHistoryStore): DebugHistorySnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
