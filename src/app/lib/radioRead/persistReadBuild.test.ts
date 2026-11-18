import { expect, it } from 'vitest';
import { newProjectMeta, newRadioBuildWithEgresses } from '@core/domain/factories.ts';
import { InMemoryProjectPersistence } from '@integrations/persistence/index.ts';
import { persistReadBuild } from './persistReadBuild.ts';

it('creates a build and egresses, updates its revision and reports a conflict', async () => {
  const persistence = new InMemoryProjectPersistence();
  const meta = newProjectMeta('Test');
  await persistence.seedProject({ meta });
  const { build, egressPaths } = newRadioBuildWithEgresses(meta.projectId, 'baofeng-uv5r-mini');
  expect(await persistReadBuild(persistence, { kind: 'create', build, egressPaths })).toEqual({
    ok: true,
    buildId: build.id,
  });
  const stored = (await persistence.getRadioBuild(meta.projectId, build.id))!;
  for (const egress of egressPaths)
    expect(await persistence.getEgressPath(meta.projectId, egress.id)).not.toBeNull();
  expect(
    await persistReadBuild(persistence, {
      kind: 'update',
      build: stored,
      expectedRevision: stored.revision,
    }),
  ).toEqual({ ok: true, buildId: build.id });
  expect((await persistence.getRadioBuild(meta.projectId, build.id))?.revision).toBe(
    stored.revision + 1,
  );
  expect(
    await persistReadBuild(persistence, {
      kind: 'update',
      build: stored,
      expectedRevision: stored.revision,
    }),
  ).toMatchObject({ ok: false, reason: 'revision_conflict' });
});
