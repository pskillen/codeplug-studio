import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RadioBuild } from '@core/models/radioBuild.ts';
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
import { assemble, type LibrarySlice } from '@core/services/assemble.ts';
import { BuildCapabilityTrait } from '@core/models/traits.ts';
import {
  hasMxNChannelExpansion,
  radioTargetHasTrait,
  traitsForRadioTarget,
} from '@core/radio-targets/index.ts';
import {
  expandAllMxNChannels,
  mxnExpansionByChannelId,
  type ExpandedMxNChannelRow,
} from '@core/import-export/channelExpansion/mxnExpandAll.ts';
import { mergeExportOptions } from '@core/import-export/exportSettingsMerge.ts';
import { egressIdentityForBuild } from '../lib/buildEgressUi.ts';
import { useBuildLayout } from '../routes/builds/BuildLayoutContext.tsx';
import { useProjects } from '../state/useProjects.ts';
import { useFormatBuilds } from '../state/useFormatBuilds.ts';
import { persistence } from '../state/persistence.ts';
import { BuildService } from '../state/buildService.ts';
import { loadLibrarySlice } from '../lib/loadLibrarySlice.ts';

const buildService = new BuildService(persistence);

export function zoneScanExportSupported(build: RadioBuild): boolean {
  const traits = traitsForRadioTarget(build.radioTargetId);
  return (
    traits.includes(BuildCapabilityTrait.ZoneGrouping) &&
    (traits.includes(BuildCapabilityTrait.ScanLists) ||
      traits.includes(BuildCapabilityTrait.DedicatedScanLists))
  );
}

export function zoneGroupingLayoutSupported(build: RadioBuild): boolean {
  return radioTargetHasTrait(build.radioTargetId, BuildCapabilityTrait.ZoneGrouping);
}

export function scanListMemberCapForBuild(formatId: string, profileId: string): number {
  return scanListMemberCapForProfile(formatId as FormatId, profileId);
}

export function useZoneScanExportLayout() {
  const { build, activeEgress } = useBuildLayout();
  const { activeProjectId } = useProjects();
  const { putBuild } = useFormatBuilds();
  const [library, setLibrary] = useState<LibrarySlice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const egress = useMemo(() => egressIdentityForBuild(build, activeEgress), [build, activeEgress]);

  const layoutSupported = zoneGroupingLayoutSupported(build);
  const enabled = zoneScanExportSupported(build);
  const showScanCarrierControls = enabled;
  const scanListMemberCap = scanListMemberCapForBuild(egress.formatId, egress.profileId);

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

  /** MxN expansion keyed by parent channel — Scan-tab nest + counts (#570). */
  const expansionByChannelId = useMemo((): Map<string, ExpandedMxNChannelRow[]> | undefined => {
    if (!library || !enabled || !hasMxNChannelExpansion(build.radioTargetId)) return undefined;
    const assembled = assemble(build, library);
    const options = mergeExportOptions(
      build,
      egress.formatId,
      { profileId: egress.profileId },
      library,
    );
    const warnings: string[] = [];
    const rows = expandAllMxNChannels({
      assembled,
      library,
      radioTargetId: build.radioTargetId,
      options,
      warnings,
    });
    return mxnExpansionByChannelId(rows);
  }, [library, enabled, build, egress.formatId, egress.profileId]);

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
    (exportedZoneId: string, memberKey: string, includeInScanList: boolean) => {
      if (!layout) return;
      const entry = layout.zones.find((zone) => zone.id === exportedZoneId);
      const nextInclusion = { ...(entry?.scanMemberInclusion ?? {}) };
      if (includeInScanList) {
        delete nextInclusion[memberKey];
      } else {
        nextInclusion[memberKey] = 'skip';
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
    expansionByChannelId,
    zoneBehaviourContext,
    saving,
    error,
    updateZoneEntry,
    setZoneMemberChannelIds,
    updateMemberScanInclusion,
  };
}
