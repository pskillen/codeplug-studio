import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { ZoneGroupingLayout, ZoneGroupingZoneEntry } from '@core/models/traitLayout.ts';
import {
  findZoneGroupingSection,
  syncZoneGroupingWithLibrary,
  updateZoneChannelIds,
  updateZoneGroupingEntry,
} from '@core/domain/zoneGroupingLayout.ts';
import { scanListMemberCapForProfile } from '@core/import-export/formatProfiles.ts';
import type { FormatId } from '@core/import-export/types.ts';
import { buildZoneBehaviourContext } from '@core/import-export/zoneBehaviourDefaults/index.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { BuildCapabilityTrait, traitProfileFor } from '@core/models/traits.ts';
import { useBuildLayout } from '../routes/builds/BuildLayoutContext.tsx';
import { useProjects } from '../state/useProjects.ts';
import { useFormatBuilds } from '../state/useFormatBuilds.ts';
import { persistence } from '../state/persistence.ts';
import { BuildService } from '../state/buildService.ts';
import { loadLibrarySlice } from '../lib/loadLibrarySlice.ts';

const buildService = new BuildService(persistence);

export function zoneScanExportSupported(build: FormatBuild): boolean {
  const traits = traitProfileFor(build.profileId)?.traits ?? [];
  return (
    traits.includes(BuildCapabilityTrait.ZoneGrouping) &&
    (traits.includes(BuildCapabilityTrait.ScanLists) ||
      traits.includes(BuildCapabilityTrait.DedicatedScanLists))
  );
}

export function zoneGroupingLayoutSupported(build: FormatBuild): boolean {
  const profile = traitProfileFor(build.profileId);
  return profile?.traits.includes(BuildCapabilityTrait.ZoneGrouping) ?? false;
}

export function scanListMemberCapForBuild(build: FormatBuild): number {
  return scanListMemberCapForProfile(build.formatId as FormatId, build.profileId);
}

export function useZoneScanExportLayout() {
  const { build } = useBuildLayout();
  const { activeProjectId } = useProjects();
  const { putBuild } = useFormatBuilds();
  const [library, setLibrary] = useState<LibrarySlice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const layoutSupported = zoneGroupingLayoutSupported(build);
  const enabled = zoneScanExportSupported(build);
  const showScanCarrierControls = enabled;
  const scanListMemberCap = scanListMemberCapForBuild(build);

  useEffect(() => {
    if (!activeProjectId || !layoutSupported) return;
    let cancelled = false;
    void loadLibrarySlice(persistence, activeProjectId).then((slice) => {
      if (!cancelled) setLibrary(slice);
    });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, build.updatedAt, layoutSupported]);

  const layout = useMemo(() => {
    if (!library || !layoutSupported) return null;
    const existing = findZoneGroupingSection(build);
    return syncZoneGroupingWithLibrary(existing, library);
  }, [build, library, layoutSupported]);

  const zoneBehaviourContext = useMemo(
    () => buildZoneBehaviourContext(library?.zoneDefaults, build.exportSettings),
    [library?.zoneDefaults, build.exportSettings],
  );

  const zoneById = useMemo(
    () => new Map((library?.zones ?? []).map((zone) => [zone.id, zone])),
    [library],
  );

  const channelById = useMemo(
    () => new Map((library?.channels ?? []).map((channel) => [channel.id, channel])),
    [library],
  );

  const persistLayout = useCallback(
    async (nextLayout: ZoneGroupingLayout) => {
      setSaving(true);
      const result = await putBuild(
        buildService.withZoneGroupingSection(build, nextLayout),
        build.revision,
      );
      setSaving(false);
      if (!result.ok) {
        setError(
          result.reason === 'revision_conflict'
            ? 'Build changed elsewhere — reload.'
            : 'Save failed.',
        );
      } else {
        setError(null);
      }
    },
    [build, putBuild],
  );

  const updateZoneEntry = useCallback(
    (zoneId: string, patch: Partial<ZoneGroupingZoneEntry>) => {
      if (!layout) return;
      void persistLayout(updateZoneGroupingEntry(layout, zoneId, patch));
    },
    [layout, persistLayout],
  );

  const setZoneMemberChannelIds = useCallback(
    (zoneId: string, channelIds: string[]) => {
      if (!layout) return;
      void persistLayout(updateZoneChannelIds(layout, zoneId, channelIds));
    },
    [layout, persistLayout],
  );

  /** Persist per-exported-zone projection skip/include — does not mutate library zones. */
  const updateMemberScanInclusion = useCallback(
    (exportedZoneId: string, channelId: string, includeInScanList: boolean) => {
      if (!layout) return;
      const entry = layout.zones.find((zone) => zone.id === exportedZoneId);
      const nextInclusion = { ...(entry?.scanMemberInclusion ?? {}) };
      if (includeInScanList) {
        delete nextInclusion[channelId];
      } else {
        nextInclusion[channelId] = 'skip';
      }
      const scanMemberInclusion = Object.keys(nextInclusion).length > 0 ? nextInclusion : undefined;
      void persistLayout(updateZoneGroupingEntry(layout, exportedZoneId, { scanMemberInclusion }));
    },
    [layout, persistLayout],
  );

  return {
    layoutSupported,
    enabled,
    showScanCarrierControls,
    scanListMemberCap,
    layout,
    library,
    zoneById,
    channelById,
    zoneBehaviourContext,
    saving,
    error,
    updateZoneEntry,
    setZoneMemberChannelIds,
    updateMemberScanInclusion,
  };
}
