import { describe, expect, it } from 'vitest';
import { getImportAdapter } from '@core/import-export/registry.ts';
import { isSingleFileProjectImportAdapter } from '@core/import-export/importAdapter.ts';
import { exportProjectYaml } from '@core/services/exportProjectYaml.ts';
import { importProjectYaml } from '@core/services/importProjectYaml.ts';
import type { ProjectInterchangePort } from '@core/services/projectInterchangePort.ts';
import { seedToAggregate } from '@core/services/projectSeedMapping.ts';
import { projectWithRadioBuildAggregate } from '@core/import-export/formats/native-yaml/testFixtures.ts';
import {
  InMemoryProjectPersistence,
  seedFromAggregate,
  type ProjectPersistence,
  type ProjectSeed,
} from '@integrations/persistence/index.ts';

function asInterchangePort(store: ProjectPersistence): ProjectInterchangePort {
  return {
    seedProject: (seed) => store.seedProject(seed as ProjectSeed),
    replaceProject: (projectId, seed) => store.replaceProject(projectId, seed as ProjectSeed),
    loadProjectSeed: (projectId) => store.loadProjectSeed(projectId),
    putProjectMeta: (row, expectedRevision) => store.putProjectMeta(row, expectedRevision),
  };
}

describe('native YAML interchange system', () => {
  it('export → replaceExisting → reload matches exported document', async () => {
    const persistence = new InMemoryProjectPersistence();
    const sourceAggregate = projectWithRadioBuildAggregate();
    await persistence.seedProject(seedFromAggregate(sourceAggregate));
    const port = asInterchangePort(persistence);
    const projectId = sourceAggregate.meta.projectId;

    const exported = await exportProjectYaml(port, projectId, {
      fileName: 'north-wales.yaml',
      recordDestination: 'localFile',
    });

    await importProjectYaml(port, exported.content, { kind: 'replaceExisting', projectId });

    const reloaded = await persistence.loadProjectSeed(projectId);
    expect(reloaded).not.toBeNull();

    const reloadedAggregate = seedToAggregate(reloaded!);
    const importAdapter = getImportAdapter('native-yaml');
    if (!isSingleFileProjectImportAdapter(importAdapter)) {
      throw new Error('expected single-file import adapter');
    }
    const parsedFromExport = importAdapter.parseDocument(exported.content).project;
    // Interchange metadata is written during export before replace reload.
    expect(reloadedAggregate.meta.interchange?.localFile?.fileName).toBe('north-wales.yaml');
    expect(reloadedAggregate.meta.interchange?.localFile?.exportedAt).toBeTruthy();

    expect(reloadedAggregate.channels).toEqual(parsedFromExport.channels);
    expect(reloadedAggregate.radioBuilds).toEqual(parsedFromExport.radioBuilds);
    expect(reloadedAggregate.egressPaths).toEqual(parsedFromExport.egressPaths);
    expect(reloadedAggregate.meta.name).toBe(parsedFromExport.meta.name);
  });

  it('seedPreservingId import on empty store keeps the YAML project id', async () => {
    const sourcePersistence = new InMemoryProjectPersistence();
    const sourceAggregate = projectWithRadioBuildAggregate();
    await sourcePersistence.seedProject(seedFromAggregate(sourceAggregate));
    const sourcePort = asInterchangePort(sourcePersistence);
    const projectId = sourceAggregate.meta.projectId;

    const exported = await exportProjectYaml(sourcePort, projectId);

    const targetPersistence = new InMemoryProjectPersistence();
    const targetPort = asInterchangePort(targetPersistence);
    const imported = await importProjectYaml(targetPort, exported.content, {
      kind: 'seedPreservingId',
    });

    expect(imported.projectId).toBe(projectId);
    expect(await targetPersistence.listProjects()).toHaveLength(1);
    const loaded = await targetPersistence.loadProjectSeed(projectId);
    expect(loaded?.meta.projectId).toBe(projectId);
  });

  it('export YAML contains the local project id', async () => {
    const persistence = new InMemoryProjectPersistence();
    const sourceAggregate = projectWithRadioBuildAggregate();
    await persistence.seedProject(seedFromAggregate(sourceAggregate));
    const port = asInterchangePort(persistence);
    const projectId = sourceAggregate.meta.projectId;

    const exported = await exportProjectYaml(port, projectId);

    const importAdapter = getImportAdapter('native-yaml');
    if (!isSingleFileProjectImportAdapter(importAdapter)) {
      throw new Error('expected single-file import adapter');
    }
    const parsed = importAdapter.parseDocument(exported.content).project;
    expect(parsed.meta.projectId).toBe(projectId);
    expect(parsed.meta.id).toBe(projectId);
  });

  it('createNew import seeds an isolated project', async () => {
    const persistence = new InMemoryProjectPersistence();
    const existing = projectWithRadioBuildAggregate();
    await persistence.seedProject(seedFromAggregate(existing));
    const port = asInterchangePort(persistence);

    const exported = await exportProjectYaml(port, existing.meta.projectId);
    const created = await importProjectYaml(port, exported.content, { kind: 'createNew' });

    expect(created.projectId).not.toBe(existing.meta.projectId);
    expect(await persistence.listProjects()).toHaveLength(2);
    const loaded = await persistence.loadProjectSeed(created.projectId);
    expect(loaded?.channels).toHaveLength(existing.channels.length);
  });
});
