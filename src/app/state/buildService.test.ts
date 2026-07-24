import { describe, expect, it } from 'vitest';
import { newProjectMeta } from '@core/domain/factories.ts';
import { InMemoryProjectPersistence } from '@integrations/persistence/index.ts';
import { BuildService } from './buildService.ts';

async function setup() {
  const persistence = new InMemoryProjectPersistence();
  const meta = newProjectMeta('Test');
  await persistence.seedProject({ meta });
  return { persistence, service: new BuildService(persistence), projectId: meta.projectId };
}

describe('BuildService', () => {
  it('creates a radio build and seeds its compatible egress paths', async () => {
    const { service, projectId } = await setup();
    const outcome = await service.createBuild(projectId, 'baofeng-dm1701', 'Handheld');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.build.name).toBe('Handheld');
    expect(outcome.build.radioTargetId).toBe('baofeng-dm1701');
    expect(outcome.egressPaths).toHaveLength(2);
    expect(outcome.egressPaths.map((e) => e.formatId)).toEqual(['radio-io', 'opengd77']);

    const builds = await service.listBuilds(projectId);
    expect(builds).toHaveLength(1);
    expect(builds[0]?.name).toBe('Handheld');

    const egressPaths = await service.listEgressPaths(projectId, outcome.build.id);
    expect(egressPaths).toHaveLength(2);
    expect(egressPaths[0]?.radioBuildId).toBe(outcome.build.id);
  });

  it('seeds every compatible egress for multi-egress radio targets', async () => {
    const { service, projectId } = await setup();
    const outcome = await service.createBuild(projectId, 'baofeng-uv5r-mini');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.egressPaths.map((e) => e.formatId)).toEqual(['radio-io', 'neonplug', 'chirp']);
    expect(outcome.build.defaultEgressPathId).toBe(outcome.egressPaths[0]?.id);
    expect(outcome.egressPaths[0]?.formatId).toBe('radio-io');
  });

  it('rejects unknown radio target on create', async () => {
    const { service, projectId } = await setup();
    await expect(service.createBuild(projectId, 'unknown-target')).rejects.toThrow(
      /Unknown radio target/,
    );
  });

  it('updates build name via withUpdatedName and putBuild', async () => {
    const { service, projectId } = await setup();
    const created = await service.createBuild(projectId, 'tyt-md9600');
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = service.withUpdatedName(created.build, 'Mobile DMR');
    const result = await service.putBuild(updated, created.build.revision);
    expect(result.ok).toBe(true);

    const reloaded = await service.getBuild(projectId, created.build.id);
    expect(reloaded?.name).toBe('Mobile DMR');
    expect(reloaded?.revision).toBe(2);
  });

  it('deletes a radio build and its egress paths', async () => {
    const { service, projectId } = await setup();
    const created = await service.createBuild(projectId, 'baofeng-dm32uv');
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await service.deleteBuild(projectId, created.build.id);

    expect(await service.getBuild(projectId, created.build.id)).toBeNull();
    expect(await service.listEgressPaths(projectId, created.build.id)).toHaveLength(0);
  });

  it('putEgressPath persists egress-scoped changes independently of the build', async () => {
    const { service, projectId } = await setup();
    const created = await service.createBuild(projectId, 'baofeng-dm1701');
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const egress = created.egressPaths[0]!;

    const relabelled = { ...egress, label: 'Custom label' };
    const result = await service.putEgressPath(relabelled, egress.revision);
    expect(result.ok).toBe(true);

    const reloaded = await service.getEgressPath(projectId, egress.id);
    expect(reloaded?.label).toBe('Custom label');
  });

  it('withEgressHydration and clearEgressHydration round-trip the hydration bag', async () => {
    const { service, projectId } = await setup();
    const created = await service.createBuild(projectId, 'baofeng-dm1701');
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const egress = created.egressPaths[0]!;

    const hydrated = service.withEgressHydration(egress, {
      formatId: egress.formatId,
      capturedAt: new Date().toISOString(),
      retain: { some: 'bytes' },
    });
    expect(hydrated.hydration?.retain).toEqual({ some: 'bytes' });

    const cleared = service.clearEgressHydration(hydrated);
    expect(cleared.hydration).toBeUndefined();
  });
});
