import { describe, expect, it } from 'vitest';
import { newChannel, newProjectMeta } from '@core/domain/factories.ts';
import { nativeYamlExportAdapter } from '@core/import-export/formats/native-yaml/adapter.ts';
import { serialiseProject } from '@core/import-export/formats/native-yaml/serialise.ts';
import { fullLibraryAggregate } from '@core/import-export/formats/native-yaml/testFixtures.ts';
import { exportProjectYaml } from './exportProjectYaml.ts';
import { importProjectYaml } from './importProjectYaml.ts';
import type { ProjectInterchangePort, ProjectSeed } from './projectInterchangePort.ts';
import { aggregateToSeed, normaliseSeedForProject, seedToAggregate } from './projectSeedMapping.ts';

function createMockPort(initial?: ProjectSeed): ProjectInterchangePort & {
  seeds: Map<string, ProjectSeed>;
} {
  const seeds = new Map<string, ProjectSeed>();
  if (initial) {
    seeds.set(initial.meta.projectId, initial);
  }

  return {
    seeds,
    async seedProject(seed: ProjectSeed) {
      seeds.set(seed.meta.projectId, structuredClone(seed));
    },
    async replaceProject(projectId: string, seed: ProjectSeed) {
      seeds.set(projectId, structuredClone(seed));
    },
    async loadProjectSeed(projectId: string) {
      return seeds.get(projectId) ?? null;
    },
    async putProjectMeta(row, expectedRevision) {
      const seed = seeds.get(row.projectId);
      if (!seed) return { ok: false, reason: 'not_found' };
      if (expectedRevision !== null && seed.meta.revision !== expectedRevision) {
        return { ok: false, reason: 'revision_conflict' };
      }
      seed.meta = { ...row, revision: row.revision + 1 };
      return { ok: true, revision: seed.meta.revision };
    },
  };
}

describe('importProjectYaml', () => {
  it('createNew assigns a fresh project id and seeds persistence', async () => {
    const port = createMockPort();
    const aggregate = fullLibraryAggregate();
    const yaml = serialiseProject(aggregate);
    const sourceProjectId = aggregate.meta.projectId;

    const result = await importProjectYaml(port, yaml, { kind: 'createNew' });

    expect(result.projectId).not.toBe(sourceProjectId);
    const loaded = await port.loadProjectSeed(result.projectId);
    expect(loaded?.meta.projectId).toBe(result.projectId);
    expect(loaded?.channels?.every((c) => c.projectId === result.projectId)).toBe(true);
  });

  it('replaceExisting replaces rows for the active project id', async () => {
    const meta = newProjectMeta('Active');
    const port = createMockPort({ meta, channels: [newChannel(meta.projectId, 'Old')] });

    const replacement = seedToAggregate(
      normaliseSeedForProject(aggregateToSeed(fullLibraryAggregate()), meta.projectId),
    );
    const yaml = serialiseProject(replacement);

    await importProjectYaml(port, yaml, { kind: 'replaceExisting', projectId: meta.projectId });

    const loaded = await port.loadProjectSeed(meta.projectId);
    expect(loaded?.channels?.some((c) => c.name === 'GB3DA Demo')).toBe(true);
    expect(loaded?.channels?.some((c) => c.name === 'Old')).toBe(false);
  });

  it('replaceExisting rejects mismatched project ids', async () => {
    const port = createMockPort();
    const aggregate = fullLibraryAggregate();
    const yaml = serialiseProject(aggregate);

    await expect(
      importProjectYaml(port, yaml, { kind: 'replaceExisting', projectId: 'other-id' }),
    ).rejects.toThrow(/does not match active project/);
  });
});

describe('exportProjectYaml', () => {
  it('serialises the loaded seed via the native-yaml adapter', async () => {
    const aggregate = fullLibraryAggregate();
    const port = createMockPort(aggregateToSeed(aggregate));

    const result = await exportProjectYaml(port, aggregate.meta.projectId);

    expect(result.fileName).toMatch(/\.yaml$/);
    expect(result.content).toContain('schemaVersion:');
    const roundTrip = nativeYamlExportAdapter.serialise(aggregate);
    expect(result.content).toBe(roundTrip.content);
  });

  it('records localFile interchange metadata when requested', async () => {
    const aggregate = fullLibraryAggregate();
    const port = createMockPort(aggregateToSeed(aggregate));

    await exportProjectYaml(port, aggregate.meta.projectId, {
      fileName: 'my-export.yaml',
      recordDestination: 'localFile',
    });

    const loaded = await port.loadProjectSeed(aggregate.meta.projectId);
    expect(loaded?.meta.interchange?.localFile?.fileName).toBe('my-export.yaml');
    expect(loaded?.meta.interchange?.localFile?.exportedAt).toBeTruthy();
  });

  it('records googleDrive interchange metadata when requested', async () => {
    const aggregate = fullLibraryAggregate();
    const port = createMockPort(aggregateToSeed(aggregate));

    await exportProjectYaml(port, aggregate.meta.projectId, {
      fileName: 'my-export.yaml',
      recordDestination: 'googleDrive',
      driveDestination: {
        folderId: 'folder-1',
        folderName: 'Codeplugs',
        fileId: 'file-1',
      },
    });

    const loaded = await port.loadProjectSeed(aggregate.meta.projectId);
    expect(loaded?.meta.interchange?.googleDrive).toMatchObject({
      fileName: 'my-export.yaml',
      folderId: 'folder-1',
      folderName: 'Codeplugs',
      fileId: 'file-1',
    });
  });
});
