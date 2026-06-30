import { describe, expect, it } from 'vitest';
import { InMemoryProjectPersistence } from '@integrations/persistence/index.ts';
import { ProjectStore } from './projectStore.ts';

function makeStore(): ProjectStore {
  return new ProjectStore(new InMemoryProjectPersistence());
}

describe('ProjectStore', () => {
  it('creates a blank project and lists it', async () => {
    const store = makeStore();
    const created = await store.create('North Wales');

    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.projectId).toBe(created.projectId);
    expect(list[0]?.name).toBe('North Wales');
  });

  it('trims names and falls back to a default when blank', async () => {
    const store = makeStore();
    await store.create('  Spaced  ');
    await store.create('   ');

    const names = (await store.list()).map((p) => p.name).sort();
    expect(names).toEqual(['Spaced', 'Untitled project']);
  });

  it('renames a project', async () => {
    const store = makeStore();
    const created = await store.create('Old name');

    const renamed = await store.rename(created.projectId, 'New name');
    expect(renamed?.name).toBe('New name');

    const loaded = await store.get(created.projectId);
    expect(loaded?.name).toBe('New name');
  });

  it('deletes a project', async () => {
    const store = makeStore();
    const created = await store.create('Disposable');

    await store.delete(created.projectId);

    expect(await store.list()).toHaveLength(0);
    expect(await store.get(created.projectId)).toBeNull();
  });
});
