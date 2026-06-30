import { newProjectMeta } from '@core/domain/factories.ts';
import type { ProjectMeta } from '@core/models/project.ts';
import {
  InMemoryProjectPersistence,
  type ProjectPersistence,
} from '@integrations/persistence/index.ts';

const DEFAULT_PROJECT_NAME = 'Untitled project';

/**
 * Thin app-state adapter over the `ProjectPersistence` port. Owns project
 * lifecycle (create blank project + empty library, rename, delete, list) and
 * keeps the app layer decoupled from the concrete persistence implementation.
 *
 * Defaults to the in-memory port; Phase 2 Ticket #9 swaps in IndexedDB without
 * touching callers.
 */
export class ProjectStore {
  constructor(
    private readonly persistence: ProjectPersistence = new InMemoryProjectPersistence(),
  ) {}

  async list(): Promise<ProjectMeta[]> {
    return this.persistence.listProjects();
  }

  async get(projectId: string): Promise<ProjectMeta | null> {
    return this.persistence.loadProjectMeta(projectId);
  }

  /** Create a blank project with an empty library and persist its metadata. */
  async create(name: string): Promise<ProjectMeta> {
    const meta = newProjectMeta(normaliseName(name, DEFAULT_PROJECT_NAME));
    await this.persistence.seedProject({ meta });
    return meta;
  }

  async rename(projectId: string, name: string): Promise<ProjectMeta | null> {
    const meta = await this.persistence.loadProjectMeta(projectId);
    if (!meta) return null;
    const result = await this.persistence.putProjectMeta(
      { ...meta, name: normaliseName(name, meta.name) },
      meta.revision,
    );
    if (!result.ok) return meta;
    return this.persistence.loadProjectMeta(projectId);
  }

  async delete(projectId: string): Promise<void> {
    await this.persistence.deleteEntity(projectId, 'project', projectId);
  }
}

function normaliseName(name: string, fallback: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}
