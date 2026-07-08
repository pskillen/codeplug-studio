import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import {
  isEntityExcluded,
  isEntityForceIncluded,
  overrideByEntityId,
} from '@core/domain/formatBuildOverrides.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import {
  isPreviewRowIncludedInExport,
  overrideFieldForEntityKind,
  previewWireRows,
  type WirePreviewEntityKind,
  type WirePreviewRow,
} from '@core/services/previewWireRows.ts';
import { traitProfileFor } from '@core/models/traits.ts';
import { getFormatProfiles } from '@core/import-export/formatProfiles.ts';
import type { FormatId } from '@core/import-export/types.ts';
import { mergeExportOptions } from '@core/services/exportBuild.ts';
import { useBuildLayout } from '../routes/builds/BuildLayoutContext.tsx';
import { useProjects } from '../state/useProjects.ts';
import { persistence } from '../state/persistence.ts';
import { BuildService } from '../state/buildService.ts';
import { loadLibrarySlice } from '../lib/loadLibrarySlice.ts';

const buildService = new BuildService(persistence);

export function useBuildWirePreview(entityKind: WirePreviewEntityKind) {
  const { build } = useBuildLayout();
  const buildRef = useRef(build);
  const saveQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    buildRef.current = build;
  }, [build]);

  const { activeProjectId } = useProjects();
  const [library, setLibrary] = useState<LibrarySlice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hideNotIncludedInExport, setHideNotIncludedInExport] = useState(false);
  const exportOptions = useMemo(() => mergeExportOptions(build), [build]);

  const allRows = useMemo(() => {
    if (!library) return [];
    return previewWireRows(build, library, entityKind, exportOptions);
  }, [build, library, entityKind, exportOptions]);

  const rows = useMemo(() => {
    if (!hideNotIncludedInExport || !library) return allRows;
    return allRows.filter((row) => isPreviewRowIncludedInExport(build, library, entityKind, row));
  }, [allRows, hideNotIncludedInExport, build, library, entityKind]);

  const hiddenRowCount = allRows.length - rows.length;

  const hasWirePreviewEntities = useMemo(() => {
    if (!library) return false;
    switch (entityKind) {
      case 'channel':
        return library.channels.length > 0;
      case 'zone':
        return library.zones.length > 0;
      case 'scanList': {
        const layout = build.layout.sections.find((s) => s.kind === 'scanLists');
        return layout != null && layout.scanLists.length > 0;
      }
      case 'talkGroup':
        return library.talkGroups.length > 0;
      case 'contact':
        return library.digitalContacts.length + library.analogContacts.length > 0;
      case 'rxGroupList':
        return library.rxGroupLists.length > 0;
    }
  }, [library, entityKind]);

  const nameLimit = useMemo(() => {
    const profile = traitProfileFor(build.profileId);
    if (!profile) return undefined;
    const options = getFormatProfiles(profile.formatId as FormatId);
    return options.find((option) => option.profileId === build.profileId)?.nameLimit;
  }, [build.profileId]);

  useEffect(() => {
    if (!activeProjectId) return;
    let cancelled = false;
    void loadLibrarySlice(persistence, activeProjectId).then((slice) => {
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

  const setRowForceIncluded = useCallback(
    (row: WirePreviewRow, forceInclude: boolean) => {
      if (entityKind !== 'zone') return;
      void persistBuild((current) => {
        if (isEntityForceIncluded(current.zoneOverrides, row.libraryEntityId) === forceInclude) {
          return current;
        }
        return buildService.withEntityForceIncluded(
          current,
          'zoneOverrides',
          row.libraryEntityId,
          forceInclude,
        );
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
    allRows,
    hiddenRowCount,
    hideNotIncludedInExport,
    setHideNotIncludedInExport,
    hasWirePreviewEntities,
    nameLimit,
    error,
    saving,
    library,
    setRowExcluded,
    setRowForceIncluded,
    setRowWireName,
    persistBuild,
  };
}
