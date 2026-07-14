import { getImportAdapter } from '@core/import-export/registry.ts';
import { isSingleFileProjectImportAdapter } from '@core/import-export/importAdapter.ts';
import type { ProjectInterchangePort } from './projectInterchangePort.ts';
import {
  aggregateToSeed,
  normaliseSeedForProject,
  reassignSeedProjectId,
} from './projectSeedMapping.ts';

export type ImportProjectYamlMode =
  | { kind: 'createNew' }
  | { kind: 'seedPreservingId' }
  | { kind: 'replaceExisting'; projectId: string }
  | { kind: 'adoptRemote'; projectId: string };

export interface ImportProjectYamlResult {
  projectId: string;
  warnings: string[];
}

export async function importProjectYaml(
  port: ProjectInterchangePort,
  yamlText: string,
  mode: ImportProjectYamlMode,
): Promise<ImportProjectYamlResult> {
  const adapter = getImportAdapter('native-yaml');
  if (!isSingleFileProjectImportAdapter(adapter)) {
    throw new Error('native-yaml import adapter must be single-file');
  }
  const { project: aggregate, warnings } = adapter.parseDocument(yamlText);
  let seed = aggregateToSeed(aggregate);

  if (mode.kind === 'createNew') {
    seed = reassignSeedProjectId(seed);
    await port.seedProject(seed);
    return { projectId: seed.meta.projectId, warnings };
  }

  if (mode.kind === 'seedPreservingId') {
    const { projectId } = seed.meta;
    const existing = await port.loadProjectSeed(projectId);
    if (existing) {
      throw new Error(
        `YAML project id (${projectId}) already exists locally — use replaceExisting instead`,
      );
    }
    await port.seedProject(seed);
    return { projectId, warnings };
  }

  const { projectId } = mode;

  if (mode.kind === 'replaceExisting' && seed.meta.projectId !== projectId) {
    throw new Error(
      `YAML project id (${seed.meta.projectId}) does not match active project (${projectId})`,
    );
  }

  seed = normaliseSeedForProject(seed, projectId);
  await port.replaceProject(projectId, seed);
  return { projectId, warnings };
}
