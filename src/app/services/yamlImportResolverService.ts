import { getImportAdapter } from '@core/import-export/registry.ts';
import { isSingleFileProjectImportAdapter } from '@core/import-export/importAdapter.ts';
import {
  buildProjectSyncDiff,
  summariseProjectAggregate,
  summariseProjectSeed,
  type ProjectSyncDiff,
  type ProjectSyncSummary,
} from '@core/services/projectSyncSummary.ts';
import type { ProjectMeta } from '@core/models/project.ts';
import { persistence } from '../state/persistence.ts';

export interface YamlImportPreview {
  projectId: string;
  projectName: string;
  yamlText: string;
  remoteSummary: ProjectSyncSummary;
}

export function parseYamlImportPreview(yamlText: string): YamlImportPreview {
  const adapter = getImportAdapter('native-yaml');
  if (!isSingleFileProjectImportAdapter(adapter)) {
    throw new Error('native-yaml import adapter must be single-file');
  }
  const { project } = adapter.parseDocument(yamlText);
  const remoteSummary = summariseProjectAggregate(project);
  return {
    projectId: project.meta.projectId,
    projectName: project.meta.name,
    yamlText,
    remoteSummary,
  };
}

export async function findExistingProjectMeta(projectId: string): Promise<ProjectMeta | null> {
  return persistence.loadProjectMeta(projectId);
}

export async function buildImportOverwriteDiff(
  projectId: string,
  remoteSummary: ProjectSyncSummary,
): Promise<ProjectSyncDiff> {
  const seed = await persistence.loadProjectSeed(projectId);
  if (!seed) {
    return buildProjectSyncDiff(remoteSummary, remoteSummary);
  }
  const localSummary = summariseProjectSeed(seed);
  return buildProjectSyncDiff(localSummary, remoteSummary);
}

export function projectExistsInList(projectId: string, projects: ProjectMeta[]): boolean {
  return projects.some((project) => project.projectId === projectId);
}
