import { newRadioBuildWithEgresses } from '@core/domain/factories.ts';
import { type OverrideField, upsertOverride } from '@core/domain/formatBuildOverrides.ts';
import type { CpsWireHydration } from '@core/models/cpsWireHydration.ts';
import type { BuildExportSettings, RadioBuild } from '@core/models/radioBuild.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { ScanInclusion } from '@core/models/library.ts';
import { isoNow, nextRevision } from '@core/models/revision.ts';
import type { ScanListsLayout, ZoneGroupingLayout } from '@core/models/traitLayout.ts';
import type { PutResult } from '@integrations/persistence/index.ts';
import type { ProjectPersistence } from '@integrations/persistence/index.ts';

/**
 * App-layer service for {@link RadioBuild} + {@link EgressPath} persistence over
 * the {@link ProjectPersistence} port (#654).
 */
export class BuildService {
  constructor(private readonly persistence: ProjectPersistence) {}

  async listBuilds(projectId: string): Promise<RadioBuild[]> {
    return this.persistence.listRadioBuilds(projectId);
  }

  async getBuild(projectId: string, id: string): Promise<RadioBuild | null> {
    return this.persistence.getRadioBuild(projectId, id);
  }

  async listEgressPaths(projectId: string, radioBuildId: string): Promise<EgressPath[]> {
    return this.persistence.listEgressPathsForBuild(projectId, radioBuildId);
  }

  async getEgressPath(projectId: string, id: string): Promise<EgressPath | null> {
    return this.persistence.getEgressPath(projectId, id);
  }

  async putEgressPath(egress: EgressPath, expectedRevision: number | null): Promise<PutResult> {
    return this.persistence.putEgressPath(egress, expectedRevision);
  }

  /**
   * Create a radio build for a catalog target and seed every compatible egress
   * pathway for it. Throws if `radioTargetId` is not in the catalog.
   */
  async createBuild(
    projectId: string,
    radioTargetId: string,
    name?: string,
  ): Promise<
    | { ok: true; build: RadioBuild; egressPaths: EgressPath[] }
    | { ok: false; reason: string }
  > {
    const { build, egressPaths } = newRadioBuildWithEgresses(projectId, radioTargetId, name);
    const buildResult = await this.persistence.putRadioBuild(build, null);
    if (!buildResult.ok) {
      return { ok: false, reason: buildResult.reason ?? 'Save failed' };
    }
    for (const egress of egressPaths) {
      const egressResult = await this.persistence.putEgressPath(egress, null);
      if (!egressResult.ok) {
        return { ok: false, reason: egressResult.reason ?? 'Save failed' };
      }
    }
    return { ok: true, build, egressPaths };
  }

  async putBuild(build: RadioBuild, expectedRevision: number | null): Promise<PutResult> {
    return this.persistence.putRadioBuild(build, expectedRevision);
  }

  /** Delete a radio build and every egress path scoped to it. */
  async deleteBuild(projectId: string, id: string): Promise<void> {
    const egressPaths = await this.persistence.listEgressPathsForBuild(projectId, id);
    for (const egress of egressPaths) {
      await this.persistence.deleteEntity(projectId, 'egressPath', egress.id);
    }
    await this.persistence.deleteEntity(projectId, 'radioBuild', id);
  }

  /** Touch name and updatedAt before save. */
  withUpdatedName(build: RadioBuild, name: string): RadioBuild {
    const now = isoNow();
    return {
      ...build,
      name: name.trim() || build.name,
      updatedAt: now,
      revision: nextRevision(build.revision),
    };
  }

  /** Change the preferred egress for the Export UI (formatId/profileId live on the egress, #654). */
  withDefaultEgressPathId(build: RadioBuild, egressPathId: string | undefined): RadioBuild {
    const now = isoNow();
    return {
      ...build,
      defaultEgressPathId: egressPathId,
      updatedAt: now,
      revision: nextRevision(build.revision),
    };
  }

  withEntityExcluded(
    build: RadioBuild,
    field: OverrideField,
    libraryEntityId: string,
    excluded: boolean,
  ): RadioBuild {
    const now = isoNow();
    return {
      ...build,
      [field]: upsertOverride(build[field], libraryEntityId, { excluded }),
      updatedAt: now,
      revision: nextRevision(build.revision),
    };
  }

  withEntityForceIncluded(
    build: RadioBuild,
    field: OverrideField,
    libraryEntityId: string,
    forceInclude: boolean,
  ): RadioBuild {
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
    build: RadioBuild,
    field: OverrideField,
    libraryEntityId: string,
    wireName: string | undefined,
  ): RadioBuild {
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

  /** Per-channel scan inclusion override on channelOverrides (flat-memory / CHIRP Skip). */
  withScanInclusionOverride(
    build: RadioBuild,
    libraryEntityId: string,
    scanInclusion: ScanInclusion | undefined,
  ): RadioBuild {
    const now = isoNow();
    return {
      ...build,
      channelOverrides: upsertOverride(build.channelOverrides, libraryEntityId, {
        scanInclusion,
      }),
      updatedAt: now,
      revision: nextRevision(build.revision),
    };
  }

  withZoneGroupingSection(build: RadioBuild, section: ZoneGroupingLayout): RadioBuild {
    const now = isoNow();
    const other = build.layout.sections.filter((s) => s.kind !== 'zoneGrouping');
    return {
      ...build,
      layout: { sections: [...other, section] },
      updatedAt: now,
      revision: nextRevision(build.revision),
    };
  }

  withScanListsSection(build: RadioBuild, section: ScanListsLayout): RadioBuild {
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
    build: RadioBuild,
    flags: Partial<
      Pick<
        RadioBuild,
        | 'exportUnlinkedChannels'
        | 'exportUnlinkedTalkGroups'
        | 'exportUnlinkedRxGroupLists'
        | 'exportUnlinkedDigitalContacts'
        | 'exportUnlinkedAnalogContacts'
      >
    >,
  ): RadioBuild {
    const now = isoNow();
    return {
      ...build,
      ...flags,
      updatedAt: now,
      revision: nextRevision(build.revision),
    };
  }

  withExportSettings(build: RadioBuild, patch: Partial<BuildExportSettings>): RadioBuild {
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

  /** Persist or replace egress-scoped CPS wire hydration (NeonPlug donor / radio-clone image, #654). */
  withEgressHydration(egress: EgressPath, hydration: CpsWireHydration): EgressPath {
    const now = isoNow();
    return {
      ...egress,
      hydration,
      updatedAt: now,
      revision: nextRevision(egress.revision),
    };
  }

  /** Clear stored CPS wire hydration bag from an egress path. */
  clearEgressHydration(egress: EgressPath): EgressPath {
    const now = isoNow();
    const next: EgressPath = {
      ...egress,
      updatedAt: now,
      revision: nextRevision(egress.revision),
    };
    delete next.hydration;
    return next;
  }
}
