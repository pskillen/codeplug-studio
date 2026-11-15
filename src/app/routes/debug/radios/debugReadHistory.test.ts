import { describe, expect, it } from 'vitest';
import { getDebugReadHistory } from './debugReadHistory.ts';
import { exampleArchive } from './debugReadHistory.fixture.ts';
import { buildDebugReadHistoryZip, openDebugReadHistoryZip } from './debugReadHistoryArchive.ts';

describe('debug read history labels', () => {
  it('relabels one read, keeps the others, and survives a history zip round trip', () => {
    const descriptor = { slug: 'history-labels', archiveModelId: 'AT-D890UV' };
    const store = getDebugReadHistory(descriptor);
    store.clear();
    const a = store.add(exampleArchive());
    const b = store.add(exampleArchive('2026-01-02T00:00:00Z'));
    store.markDownloaded([a.id, b.id]);
    store.setLabels(a.id, { radioName: 'Radio 1', label: 'Before', description: ' note ' });
    const [first, second] = store.getSnapshot().entries;
    expect(first?.archive.manifest).toMatchObject({
      radioName: 'Radio 1',
      label: 'Before',
      description: 'note',
    });
    expect(second?.archive.manifest.radioName).toBeUndefined();
    // The saved zip changed, so that live read is not downloaded any more.
    expect(store.getSnapshot().undownloaded).toBe(1);
    expect(Array.from(first!.archive.regions.a!)).toEqual([1, 2]);
    const zip = buildDebugReadHistoryZip(descriptor, store.getSnapshot().entries);
    const reopened = openDebugReadHistoryZip(zip, descriptor);
    expect(reopened[0]?.manifest.radioName).toBe('Radio 1');
    expect(reopened[1]?.manifest.radioName).toBeUndefined();
    store.setLabels(a.id, {});
    expect(store.getSnapshot().entries[0]?.archive.manifest.radioName).toBeUndefined();
  });
});

describe('debug read history', () => {
  it('retains all reads, stable snapshots and safe download IDs across clear', () => {
    const store = getDebugReadHistory({ slug: 'history-test', archiveModelId: 'AT-D890UV' });
    store.clear();
    const first = store.add(exampleArchive());
    const captured = [first.id];
    for (let i = 1; i < 28; i++) store.add(exampleArchive());
    expect(
      store
        .getSnapshot()
        .entries.map((entry) => entry.label)
        .slice(25),
    ).toEqual(['Z', 'AA', 'AB']);
    expect(store.getSnapshot()).toBe(store.getSnapshot());
    store.markDownloaded(captured);
    expect(store.getSnapshot().undownloaded).toBe(27);
    store.clear();
    const next = store.add(exampleArchive());
    store.markDownloaded(captured);
    expect(next.id).not.toBe(first.id);
    expect(next.label).toBe('A');
    expect(store.getSnapshot().undownloaded).toBe(1);
    store.clear();
    expect(store.getSnapshot()).toEqual({
      entries: [],
      selectedId: null,
      compareId: null,
      undownloaded: 0,
    });
  });
  it('isolates slugs and imports as file provenance atomically', () => {
    const one = getDebugReadHistory({ slug: 'history-one', archiveModelId: 'AT-D890UV' });
    const two = getDebugReadHistory({ slug: 'history-two', archiveModelId: 'AT-D890UV' });
    one.clear();
    two.clear();
    const [entry] = one.importArchives([exampleArchive()]);
    expect(entry?.archive.source).toBe('file');
    expect(one.getSnapshot().undownloaded).toBe(0);
    expect(two.getSnapshot().entries).toHaveLength(0);
    const invalid = {
      ...exampleArchive(),
      manifest: { ...exampleArchive().manifest, radioModelId: 'wrong' },
    };
    expect(() => one.importArchives([exampleArchive(), invalid])).toThrow(/does not match/);
    expect(one.getSnapshot().entries).toHaveLength(1);
  });
});

describe('debug read history comparison selection', () => {
  it('keeps the comparison id with the history, rejects unknown ids and clears with it', () => {
    const store = getDebugReadHistory({ slug: 'compare-test', archiveModelId: 'AT-D890UV' });
    store.clear();
    const a = store.add(exampleArchive());
    store.add(exampleArchive());
    store.setCompare(a.id);
    expect(store.getSnapshot().compareId).toBe(a.id);
    store.setCompare('missing');
    expect(store.getSnapshot().compareId).toBeNull();
    store.setCompare(a.id);
    store.clear();
    expect(store.getSnapshot().compareId).toBeNull();
    store.add(exampleArchive());
    expect(store.getSnapshot().compareId).toBeNull();
  });
});
