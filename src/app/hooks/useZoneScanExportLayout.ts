import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { ZoneMemberEntry } from '@core/models/library.ts';
import type { ZoneGroupingLayout, ZoneGroupingZoneEntry } from '@core/models/traitLayout.ts';
import {
  findZoneGroupingSection,
  syncZoneGroupingWithLibrary,
  updateZoneGroupingEntry,
} from '@core/domain/zoneGroupingLayout.ts';
import { normalizeZoneMemberEntry } from '@core/domain/zoneMembers.ts';
import { scanListMemberCapForProfile } from '@core/import-export/formatProfiles.ts';
import type { FormatId } from '@core/import-export/types.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { useBuildLayout } from '../routes/builds/BuildLayoutContext.tsx';
import { useProjects } from '../state/useProjects.ts';
import { useFormatBuilds } from '../state/useFormatBuilds.ts';
import { persistence } from '../state/persistence.ts';
import { BuildService } from '../state/buildService.ts';
import { loadLibrarySlice } from '../lib/loadLibrarySlice.ts';

const buildService = new BuildService(persistence);

export function zoneScanExportSupported(build: FormatBuild): boolean {
  return build.formatId === 'dm32' || build.formatId === 'anytone';
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

  const enabled = zoneScanExportSupported(build);
  const isDm32 = build.formatId === 'dm32';
  const showScanCarrierControls = isDm32 || build.formatId === 'anytone';
  const scanListMemberCap = scanListMemberCapForBuild(build);

  useEffect(() => {
    if (!activeProjectId || !enabled) return;
    let cancelled = false;
    void loadLibrarySlice(persistence, activeProjectId).then((slice) => {
      if (!cancelled) setLibrary(slice);
    });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, build.updatedAt, enabled]);

  const layout = useMemo(() => {
    if (!library || !enabled) return null;
    const existing = findZoneGroupingSection(build);
    return syncZoneGroupingWithLibrary(existing, library);
  }, [build, library, enabled]);

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

  const updateMemberScanInclusion = useCallback(
    async (ownerZoneId: string, channelId: string, includeInScanList: boolean) => {
      if (!activeProjectId || !library) return;
      const zone = library.zones.find((row) => row.id === ownerZoneId);
      if (!zone) return;
      const members: ZoneMemberEntry[] = zone.members.map((raw) => {
        const member = normalizeZoneMemberEntry(raw);
        if (member.kind !== 'channel' || member.channelId !== channelId) return member;
        return {
          ...member,
          includeInScanList: includeInScanList ? undefined : false,
        };
      });
      setSaving(true);
      const result = await persistence.putZone({ ...zone, members }, zone.revision);
      setSaving(false);
      if (result.ok) {
        setLibrary((prev) =>
          prev
            ? {
                ...prev,
                zones: prev.zones.map((row) =>
                  row.id === zone.id ? { ...zone, members, revision: result.revision } : row,
                ),
              }
            : prev,
        );
        setError(null);
      } else {
        setError('Failed to save zone membership.');
      }
    },
    [activeProjectId, library],
  );

  return {
    enabled,
    isDm32,
    showScanCarrierControls,
    scanListMemberCap,
    layout,
    library,
    zoneById,
    channelById,
    saving,
    error,
    updateZoneEntry,
    updateMemberScanInclusion,
  };
}
