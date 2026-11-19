import { expect, it } from 'vitest';
import { newChannel, newProjectMeta } from '@core/domain/factories.ts';
import { InMemoryProjectPersistence } from '@integrations/persistence/index.ts';
import { persistReadChannelPlan } from './persistReadChannelPlan.ts';

it('creates and updates with revisions and reports partial progress on conflict', async () => {
  const persistence = new InMemoryProjectPersistence();
  const meta = newProjectMeta('Test');
  await persistence.seedProject({ meta });
  const before = newChannel(meta.projectId, 'old');
  await persistence.putChannel(before, null);
  const stored = (await persistence.getChannel(meta.projectId, before.id))!;
  const created = newChannel(meta.projectId, 'new');
  const update = {
    slot: 1,
    before: stored,
    after: { ...stored, name: 'updated' },
    matchedBy: 'name' as const,
    changedFields: [],
  };
  expect(
    await persistReadChannelPlan(persistence, {
      creates: [{ slot: 2, channel: created }],
      updates: [update],
    }),
  ).toEqual({ ok: true, created: 1, updated: 1 });
  expect((await persistence.getChannel(meta.projectId, before.id))!.revision).toBe(
    stored.revision + 1,
  );
  expect(await persistence.getChannel(meta.projectId, created.id)).not.toBeNull();
  const another = newChannel(meta.projectId, 'another');
  expect(
    await persistReadChannelPlan(persistence, {
      creates: [{ slot: 3, channel: another }],
      updates: [update],
    }),
  ).toMatchObject({ ok: false, reason: 'revision_conflict', created: 1, updated: 0 });
});
