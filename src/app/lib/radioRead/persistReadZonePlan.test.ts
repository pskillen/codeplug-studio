import { expect, it } from 'vitest';
import { newZone, newProjectMeta } from '@core/domain/factories.ts';
import { InMemoryProjectPersistence } from '@integrations/persistence/index.ts';
import { persistReadZonePlan } from './persistReadZonePlan.ts';

it('creates and updates with revisions and reports partial progress on conflict', async () => {
  const persistence = new InMemoryProjectPersistence();
  const meta = newProjectMeta('Test');
  await persistence.seedProject({ meta });
  const before = newZone(meta.projectId, 'old');
  await persistence.putZone(before, null);
  const stored = (await persistence.getZone(meta.projectId, before.id))!;
  const created = newZone(meta.projectId, 'new');
  const update = {
    slot: 1,
    before: stored,
    after: { ...stored, name: 'updated' },
    matchedBy: 'name' as const,
    changedFields: [],
  };
  expect(
    await persistReadZonePlan(persistence, {
      creates: [created],
      updates: [update],
    }),
  ).toEqual({ ok: true, created: 1, updated: 1 });
  expect((await persistence.getZone(meta.projectId, before.id))!.revision).toBe(
    stored.revision + 1,
  );
  expect(await persistence.getZone(meta.projectId, created.id)).not.toBeNull();
  const another = newZone(meta.projectId, 'another');
  expect(
    await persistReadZonePlan(persistence, {
      creates: [another],
      updates: [update],
    }),
  ).toMatchObject({ ok: false, reason: 'revision_conflict', created: 1, updated: 0 });
});
