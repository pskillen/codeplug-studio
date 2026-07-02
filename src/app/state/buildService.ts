import type { FormatBuild } from '@core/models/formatBuild.ts';
import { newFormatBuild } from '@core/domain/factories.ts';
import { isoNow, nextRevision } from '@core/models/revision.ts';
import type { PutResult } from '@integrations/persistence/index.ts';
import type { ProjectPersistence } from '@integrations/persistence/index.ts';

/**
 * App-layer service for format build persistence over the
 * {@link ProjectPersistence} port.
 */
export class BuildService {
  constructor(private readonly persistence: ProjectPersistence) {}

  async listBuilds(projectId: string): Promise<FormatBuild[]> {
    return this.persistence.listFormatBuilds(projectId);
  }

  async getBuild(projectId: string, id: string): Promise<FormatBuild | null> {
    return this.persistence.getFormatBuild(projectId, id);
  }

  async createBuild(
    projectId: string,
    profileId: string,
    name?: string,
  ): Promise<{ ok: true; build: FormatBuild } | { ok: false; reason: string }> {
    const build = newFormatBuild(projectId, profileId, name);
    const result = await this.persistence.putFormatBuild(build, null);
    if (!result.ok) {
      return { ok: false, reason: result.reason ?? 'Save failed' };
    }
    return { ok: true, build };
  }

  async putBuild(build: FormatBuild, expectedRevision: number | null): Promise<PutResult> {
    return this.persistence.putFormatBuild(build, expectedRevision);
  }

  async deleteBuild(projectId: string, id: string): Promise<void> {
    await this.persistence.deleteEntity(projectId, 'formatBuild', id);
  }

  /** Touch name and updatedAt before save. */
  withUpdatedName(build: FormatBuild, name: string): FormatBuild {
    const now = isoNow();
    return {
      ...build,
      name: name.trim() || build.name,
      updatedAt: now,
      revision: nextRevision(build.revision),
    };
  }

  /** Change radio profile (trait + wire variant) before save. */
  withUpdatedProfile(build: FormatBuild, profileId: string): FormatBuild {
    const now = isoNow();
    return {
      ...build,
      profileId,
      updatedAt: now,
      revision: nextRevision(build.revision),
    };
  }
}
