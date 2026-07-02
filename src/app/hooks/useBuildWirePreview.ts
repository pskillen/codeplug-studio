import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LibrarySlice } from '@core/services/assemble.ts';
import {
  overrideFieldForEntityKind,
  previewWireRows,
  type WirePreviewEntityKind,
  type WirePreviewRow,
} from '@core/services/previewWireRows.ts';
import { traitProfileFor } from '@core/models/traits.ts';
import { getFormatProfiles } from '@core/import-export/formatProfiles.ts';
import { useExportSettings } from './useExportSettings.ts';
import { useBuildLayout } from '../routes/builds/BuildLayoutContext.tsx';
import { useProjects } from '../state/useProjects.ts';
import { persistence } from '../state/persistence.ts';
import { BuildService } from '../state/buildService.ts';

const buildService = new BuildService(persistence);

async function loadLibrarySlice(projectId: string): Promise<LibrarySlice> {
  const [channels, zones, talkGroups, digitalContacts, analogContacts, rxGroupLists] =
    await Promise.all([
      persistence.listChannels(projectId),
      persistence.listZones(projectId),
      persistence.listTalkGroups(projectId),
      persistence.listDigitalContacts(projectId),
      persistence.listAnalogContacts(projectId),
      persistence.listRxGroupLists(projectId),
    ]);
  return {
    channels,
    zones,
    talkGroups,
    digitalContacts,
    analogContacts,
    rxGroupLists,
  };
}

export function useBuildWirePreview(entityKind: WirePreviewEntityKind) {
  const { build } = useBuildLayout();
  const { activeProjectId } = useProjects();
  const { exportOptionsFromSettings: optionsFromSettings } = useExportSettings();
  const [library, setLibrary] = useState<LibrarySlice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const exportOptions = useMemo(
    () => optionsFromSettings({ profileId: build.profileId }),
    [optionsFromSettings, build.profileId],
  );

  const rows = useMemo(() => {
    if (!library) return [];
    return previewWireRows(build, library, entityKind, exportOptions);
  }, [build, library, entityKind, exportOptions]);

  const nameLimit = useMemo(() => {
    const profile = traitProfileFor(build.profileId);
    if (!profile) return undefined;
    const options = getFormatProfiles(profile.formatId);
    return options.find((option) => option.profileId === build.profileId)?.nameLimit;
  }, [build.profileId]);

  useEffect(() => {
    if (!activeProjectId) return;
    let cancelled = false;
    void loadLibrarySlice(activeProjectId).then((slice) => {
      if (!cancelled) setLibrary(slice);
    });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, build.updatedAt]);

  const persistBuild = useCallback(
    async (nextBuild: typeof build) => {
      setSaving(true);
      setError(null);
      const result = await buildService.putBuild(nextBuild, build.revision);
      setSaving(false);
      if (!result.ok) {
        setError(
          result.reason === 'revision_conflict'
            ? 'This build was changed elsewhere. Reload the page.'
            : 'Save failed.',
        );
      }
    },
    [build.revision],
  );

  async function setRowExcluded(row: WirePreviewRow, excluded: boolean) {
    const field = overrideFieldForEntityKind(entityKind);
    const next = buildService.withEntityExcluded(build, field, row.libraryEntityId, excluded);
    await persistBuild(next);
  }

  async function setRowWireName(row: WirePreviewRow, wireName: string) {
    const field = overrideFieldForEntityKind(entityKind);
    const next = buildService.withWireNameOverride(build, field, row.key, wireName);
    await persistBuild(next);
  }

  return {
    build,
    rows,
    nameLimit,
    error,
    saving,
    library,
    setRowExcluded,
    setRowWireName,
    persistBuild,
  };
}
