import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RadioBuild } from '@core/models/radioBuild.ts';
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
  type AnytoneWirePreviewBank,
  type WirePreviewEntityKind,
  type WirePreviewRow,
} from '@core/services/previewWireRows.ts';
import { getFormatProfiles } from '@core/import-export/formatProfiles.ts';
import type { FormatId } from '@core/import-export/types.ts';
import { mergeExportOptions } from '@core/services/exportBuild.ts';
import { applyDenseOrderOrSlots, clearAllOrderOrSlots } from '@core/domain/exportOrderOrSlot.ts';
import { egressIdentityForBuild } from '../lib/buildEgressUi.ts';
import { useBuildLayout } from '../routes/builds/BuildLayoutContext.tsx';
import { useProjects } from '../state/useProjects.ts';
import { persistence } from '../state/persistence.ts';
import { BuildService } from '../state/buildService.ts';
import { loadLibrarySlice } from '../lib/loadLibrarySlice.ts';
import { resolveOptimisticBuild } from '../lib/resolveOptimisticBuild.ts';

const buildService = new BuildService(persistence);

export function useBuildWirePreview(
  entityKind: WirePreviewEntityKind,
  anytoneBank: AnytoneWirePreviewBank = 'dmr',
) {
  const { build: contextBuild, activeEgress } = useBuildLayout();
  const buildRef = useRef(contextBuild);
  const saveQueueRef = useRef(Promise.resolve());
  const [savedBuild, setSavedBuild] = useState<RadioBuild | null>(null);
  const build = resolveOptimisticBuild(contextBuild, savedBuild);

  useEffect(() => {
    buildRef.current = build;
  }, [build]);

  const { activeProjectId } = useProjects();
  const [library, setLibrary] = useState<LibrarySlice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hideNotIncludedInExport, setHideNotIncludedInExport] = useState(false);

  const egress = useMemo(() => egressIdentityForBuild(build, activeEgress), [build, activeEgress]);

  const exportOptions = useMemo(
    () =>
      mergeExportOptions(
        build,
        egress.formatId,
        { profileId: egress.profileId },
        library ?? undefined,
      ),
    [build, egress.formatId, egress.profileId, library],
  );

  const allRows = useMemo(() => {
    if (!library) return [];
    return previewWireRows(
      build,
      library,
      entityKind,
      { formatId: egress.formatId, profileId: egress.profileId, ...exportOptions },
      anytoneBank,
    );
  }, [build, library, entityKind, exportOptions, anytoneBank, egress.formatId, egress.profileId]);

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
  }, [library, entityKind, build.layout.sections]);

  const nameLimit = useMemo(() => {
    const options = getFormatProfiles(egress.formatId as FormatId);
    return options.find((option) => option.profileId === egress.profileId)?.nameLimit;
  }, [egress.formatId, egress.profileId]);

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

  const persistBuild = useCallback((mutate: (current: RadioBuild) => RadioBuild) => {
    const run = async () => {
      const current = buildRef.current;
      const next = mutate(current);
      if (next === current) return;

      setSaving(true);
      const result = await buildService.putBuild(next, current.revision);
      setSaving(false);
      if (result.ok) {
        const saved = { ...next, revision: result.revision };
        buildRef.current = saved;
        setSavedBuild(saved);
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
      // Channels: write against projection `key` (wire-name parity). Parent-id skip still
      // means all projections via isProjectionExcluded at preview/export.
      const entityId = entityKind === 'channel' ? row.key : row.libraryEntityId;
      void persistBuild((current) => {
        if (isEntityExcluded(current[field], entityId) === excluded) {
          return current;
        }
        return buildService.withEntityExcluded(current, field, entityId, excluded);
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

  const setEntityOrder = useCallback(
    (orderedEntityIds: string[]) => {
      const field = overrideFieldForEntityKind(entityKind);
      void persistBuild((current) => ({
        ...current,
        [field]: applyDenseOrderOrSlots(current[field], orderedEntityIds),
      }));
    },
    [entityKind, persistBuild],
  );

  const clearEntityOrderOverrides = useCallback(() => {
    const field = overrideFieldForEntityKind(entityKind);
    void persistBuild((current) => ({
      ...current,
      [field]: clearAllOrderOrSlots(current[field]),
    }));
  }, [entityKind, persistBuild]);

  const moveEntity = useCallback(
    (rowKey: string, direction: 'up' | 'down') => {
      const ids = allRows.map((row) => row.key);
      const index = ids.indexOf(rowKey);
      if (index < 0) return;
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= ids.length) return;
      [ids[index], ids[target]] = [ids[target]!, ids[index]!];
      setEntityOrder(ids);
    },
    [allRows, setEntityOrder],
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
    setEntityOrder,
    clearEntityOrderOverrides,
    moveEntity,
    persistBuild,
  };
}
