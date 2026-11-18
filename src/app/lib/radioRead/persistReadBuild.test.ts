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

it('repairs missing egress paths on retry without replacing saved paths', async () => {
  const persistence = new InMemoryProjectPersistence();
  const meta = newProjectMeta('Test');
  await persistence.seedProject({ meta });
  const { build, egressPaths } = newRadioBuildWithEgresses(meta.projectId, 'baofeng-uv5r-mini');
  await persistence.putRadioBuild(build, null);
  if (egressPaths[1]) await persistence.putEgressPath(egressPaths[1], null);
  const stored = (await persistence.getRadioBuild(meta.projectId, build.id))!;
  expect(
    await persistReadBuild(persistence, {
      kind: 'update',
      build: stored,
      expectedRevision: stored.revision,
    }),
  ).toEqual({ ok: true, buildId: build.id });
  const paths = await persistence.listEgressPathsForBuild(meta.projectId, build.id);
  expect(paths).toHaveLength(egressPaths.length);
  expect(paths.find((path) => path.id === build.defaultEgressPathId)).toBeDefined();
  if (egressPaths[1]) expect(paths).toContainEqual(egressPaths[1]);
  expect(
    await persistReadBuild(persistence, {
      kind: 'update',
      build: stored,
      expectedRevision: stored.revision + 1,
    }),
  ).toEqual({ ok: true, buildId: build.id });
  expect(await persistence.listEgressPathsForBuild(meta.projectId, build.id)).toHaveLength(
    egressPaths.length,
  );
});
