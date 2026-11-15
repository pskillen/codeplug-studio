import { describe, expect, it } from 'vitest';
import { getDebugReadHistory } from './debugReadHistory.ts';
import { exampleArchive } from './debugReadHistory.fixture.ts';

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
    expect(store.getSnapshot()).toEqual({ entries: [], selectedId: null, undownloaded: 0 });
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
