import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import { isEntityExcluded, overrideByEntityId } from '@core/domain/formatBuildOverrides.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import {
  overrideFieldForEntityKind,
  previewWireRows,
  type WirePreviewEntityKind,
  type WirePreviewRow,
} from '@core/services/previewWireRows.ts';
import { traitProfileFor } from '@core/models/traits.ts';
import { getFormatProfiles } from '@core/import-export/formatProfiles.ts';
import { useExportSettings, exportOptionsFromSettings } from './useExportSettings.ts';
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
  const buildRef = useRef(build);
  const saveQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    buildRef.current = build;
  }, [build]);

  const { activeProjectId } = useProjects();
  const { settings } = useExportSettings();
  const [library, setLibrary] = useState<LibrarySlice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const exportOptions = useMemo(
    () => exportOptionsFromSettings(settings, { profileId: build.profileId, expandModes: true }),
    [settings, build.profileId],
  );

  const rows = useMemo(() => {
    if (!library) return [];
    return previewWireRows(build, library, entityKind, exportOptions);
  }, [build, library, entityKind, exportOptions]);

  const nameLimit = useMemo(() => {
    const profile = traitProfileFor(build.profileId);
    if (!profile || profile.formatId !== 'opengd77') return undefined;
    const options = getFormatProfiles('opengd77');
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

  const persistBuild = useCallback((mutate: (current: FormatBuild) => FormatBuild) => {
    const run = async () => {
      const current = buildRef.current;
      const next = mutate(current);
      if (next === current) return;

      setSaving(true);
      const result = await buildService.putBuild(next, current.revision);
      setSaving(false);
      if (result.ok) {
        buildRef.current = { ...next, revision: result.revision };
        setError(null);
      } else {
        setError(
          result.reason === 'revision_conflict'
            ? 'This build was changed elsewhere. Reload the page.'
            : 'Save failed.',
        );
      }
    };
    saveQueueRef.current = saveQueueRef.current.then(run, run);
    return saveQueueRef.current;
  }, []);

  const setRowExcluded = useCallback(
    (row: WirePreviewRow, excluded: boolean) => {
      const field = overrideFieldForEntityKind(entityKind);
      void persistBuild((current) => {
        if (isEntityExcluded(current[field], row.libraryEntityId) === excluded) {
          return current;
        }
        return buildService.withEntityExcluded(current, field, row.libraryEntityId, excluded);
      });
    },
    [entityKind, persistBuild],
  );

  const setRowWireName = useCallback(
    (row: WirePreviewRow, wireName: string) => {
      const field = overrideFieldForEntityKind(entityKind);
      const trimmed = wireName.trim();
      void persistBuild((current) => {
        const existing = overrideByEntityId(current[field]).get(row.key)?.wireName?.trim();
        if ((existing ?? '') === trimmed) {
          return current;
        }
        return buildService.withWireNameOverride(current, field, row.key, wireName);
      });
    },
    [entityKind, persistBuild],
  );

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
