import { describe, expect, it } from 'vitest';
import { newChannel, newProjectMeta } from '@core/domain/factories.ts';
import { InMemoryProjectPersistence } from './inMemory.ts';

describe('InMemoryProjectPersistence', () => {
  it('lists seeded projects', async () => {
    const store = new InMemoryProjectPersistence();
    const meta = newProjectMeta('North Wales');
    await store.seedProject({ meta });
    const list = await store.listProjects();
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe('North Wales');
  });

  it('puts channel with revision bump', async () => {
    const store = new InMemoryProjectPersistence();
    const meta = newProjectMeta('Test');
    const channel = newChannel(meta.projectId, 'Local');
    await store.seedProject({ meta, channels: [channel] });

    const result = await store.putChannel(
      { ...channel, name: 'Local updated' },
      channel.revision,
    );
    expect(result).toEqual({ ok: true, revision: 2 });

    const loaded = await store.getChannel(meta.projectId, channel.id);
    expect(loaded?.name).toBe('Local updated');
    expect(loaded?.revision).toBe(2);
  });

  it('rejects stale revision on put', async () => {
    const store = new InMemoryProjectPersistence();
    const meta = newProjectMeta('Test');
    const channel = newChannel(meta.projectId, 'A');
    await store.seedProject({ meta, channels: [channel] });

    await store.putChannel({ ...channel, name: 'B' }, 1);
    const conflict = await store.putChannel({ ...channel, name: 'C' }, 1);
    expect(conflict).toEqual({ ok: false, reason: 'revision_conflict' });
  });

  it('isolates channels per project', async () => {
    const store = new InMemoryProjectPersistence();
    const metaA = newProjectMeta('A');
    const metaB = newProjectMeta('B');
    const chA = newChannel(metaA.projectId, 'A-ch');
    const chB = newChannel(metaB.projectId, 'B-ch');
    await store.seedProject({ meta: metaA, channels: [chA] });
    await store.seedProject({ meta: metaB, channels: [chB] });

    expect(await store.getChannel(metaA.projectId, chA.id)).not.toBeNull();
    expect(await store.getChannel(metaA.projectId, chB.id)).toBeNull();
  });
});
