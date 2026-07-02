import { getImportAdapter } from '@core/import-export/registry.ts';
import type { ProjectInterchangePort } from './projectInterchangePort.ts';
import { aggregateToSeed, normaliseSeedForProject, reassignSeedProjectId } from './projectSeedMapping.ts';

export type ImportProjectYamlMode =
  | { kind: 'createNew' }
  | { kind: 'replaceExisting'; projectId: string };

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
  const { project: aggregate, warnings } = adapter.parseDocument(yamlText);
  let seed = aggregateToSeed(aggregate);

  if (mode.kind === 'createNew') {
    seed = reassignSeedProjectId(seed);
    await port.seedProject(seed);
    return { projectId: seed.meta.projectId, warnings };
  }

  const { projectId } = mode;
  if (seed.meta.projectId !== projectId) {
    throw new Error(
      `YAML project id (${seed.meta.projectId}) does not match active project (${projectId})`,
    );
  }

  seed = normaliseSeedForProject(seed, projectId);
  await port.replaceProject(projectId, seed);
  return { projectId, warnings };
}
