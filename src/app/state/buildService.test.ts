import { describe, expect, it } from 'vitest';
import { newFormatBuild, newProjectMeta } from '@core/domain/factories.ts';
import { InMemoryProjectPersistence } from '@integrations/persistence/index.ts';
import { BuildService } from './buildService.ts';

async function setup() {
  const persistence = new InMemoryProjectPersistence();
  const meta = newProjectMeta('Test');
  await persistence.seedProject({ meta });
  return { persistence, service: new BuildService(persistence), projectId: meta.projectId };
}

describe('BuildService', () => {
  it('creates and lists format builds', async () => {
    const { service, projectId } = await setup();
    const outcome = await service.createBuild(projectId, 'opengd77-1701', 'Handheld');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const builds = await service.listBuilds(projectId);
    expect(builds).toHaveLength(1);
    expect(builds[0]?.name).toBe('Handheld');
    expect(builds[0]?.formatId).toBe('opengd77');
  });

  it('rejects unknown trait profile on create', async () => {
    const { service, projectId } = await setup();
    await expect(service.createBuild(projectId, 'unknown-profile')).rejects.toThrow(
      /Unknown trait profile/,
    );
  });

  it('updates build name via withUpdatedName and putBuild', async () => {
    const { service, projectId } = await setup();
    const created = await service.createBuild(projectId, 'opengd77-md9600');
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = service.withUpdatedName(created.build, 'Mobile DMR');
    const result = await service.putBuild(updated, created.build.revision);
    expect(result.ok).toBe(true);

    const reloaded = await service.getBuild(projectId, created.build.id);
    expect(reloaded?.name).toBe('Mobile DMR');
    expect(reloaded?.revision).toBe(2);
  });

  it('deletes a format build', async () => {
    const { persistence, service, projectId } = await setup();
    const build = newFormatBuild(projectId, 'chirp-uv5r');
    await persistence.putFormatBuild(build, null);

    await service.deleteBuild(projectId, build.id);
    expect(await service.getBuild(projectId, build.id)).toBeNull();
  });
});
