import { newFormatBuild } from '@core/domain/factories.ts';
import { type OverrideField, upsertOverride } from '@core/domain/formatBuildOverrides.ts';
import type { CpsWireHydration } from '@core/models/cpsWireHydration.ts';
import type { FormatBuild, BuildExportSettings } from '@core/models/formatBuild.ts';
import { isoNow, nextRevision } from '@core/models/revision.ts';
import type { ScanListsLayout, ZoneGroupingLayout } from '@core/models/traitLayout.ts';
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

  withEntityExcluded(
    build: FormatBuild,
    field: OverrideField,
    libraryEntityId: string,
    excluded: boolean,
  ): FormatBuild {
    const now = isoNow();
    return {
      ...build,
      [field]: upsertOverride(build[field], libraryEntityId, { excluded }),
      updatedAt: now,
      revision: nextRevision(build.revision),
    };
  }

  withEntityForceIncluded(
    build: FormatBuild,
    field: OverrideField,
    libraryEntityId: string,
    forceInclude: boolean,
  ): FormatBuild {
    const now = isoNow();
    return {
      ...build,
      [field]: upsertOverride(build[field], libraryEntityId, {
        forceInclude,
        // Force and skip are mutually exclusive in the UI for library-omit zones.
        ...(forceInclude ? { excluded: false } : {}),
      }),
      updatedAt: now,
      revision: nextRevision(build.revision),
    };
  }

  withWireNameOverride(
    build: FormatBuild,
    field: OverrideField,
    libraryEntityId: string,
    wireName: string | undefined,
  ): FormatBuild {
    const now = isoNow();
    return {
      ...build,
      [field]: upsertOverride(build[field], libraryEntityId, {
        wireName: wireName?.trim() || undefined,
      }),
      updatedAt: now,
      revision: nextRevision(build.revision),
    };
  }

  withZoneGroupingSection(build: FormatBuild, section: ZoneGroupingLayout): FormatBuild {
    const now = isoNow();
    const other = build.layout.sections.filter((s) => s.kind !== 'zoneGrouping');
    return {
      ...build,
      layout: { sections: [...other, section] },
      updatedAt: now,
      revision: nextRevision(build.revision),
    };
  }

  withScanListsSection(build: FormatBuild, section: ScanListsLayout): FormatBuild {
    const now = isoNow();
    const other = build.layout.sections.filter((s) => s.kind !== 'scanLists');
    return {
      ...build,
      layout: { sections: [...other, section] },
      updatedAt: now,
      revision: nextRevision(build.revision),
    };
  }

  withExportInclusionFlags(
    build: FormatBuild,
    flags: Partial<
      Pick<
        FormatBuild,
        | 'exportUnlinkedChannels'
        | 'exportUnlinkedTalkGroups'
        | 'exportUnlinkedRxGroupLists'
        | 'exportUnlinkedDigitalContacts'
        | 'exportUnlinkedAnalogContacts'
      >
    >,
  ): FormatBuild {
    const now = isoNow();
    return {
      ...build,
      ...flags,
      updatedAt: now,
      revision: nextRevision(build.revision),
    };
  }

  withExportSettings(build: FormatBuild, patch: Partial<BuildExportSettings>): FormatBuild {
    const now = isoNow();
    return {
      ...build,
      exportSettings: {
        ...build.exportSettings,
        ...patch,
      },
      updatedAt: now,
      revision: nextRevision(build.revision),
    };
  }

  /** Persist or replace format-scoped CPS wire hydration on the build. */
  withCpsWireHydration(build: FormatBuild, hydration: CpsWireHydration): FormatBuild {
    const now = isoNow();
    return {
      ...build,
      cpsWireHydration: hydration,
      updatedAt: now,
      revision: nextRevision(build.revision),
    };
  }

  /** Clear stored CPS wire hydration bag. */
  clearCpsWireHydration(build: FormatBuild): FormatBuild {
    const now = isoNow();
    const next: FormatBuild = {
      ...build,
      updatedAt: now,
      revision: nextRevision(build.revision),
    };
    delete next.cpsWireHydration;
    return next;
  }
}
