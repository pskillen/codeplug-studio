import { useEffect, useMemo, useState } from 'react';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import {
  isMultiFileExportAdapter,
  isSingleFileCpsExportAdapter,
} from '@core/import-export/exportAdapter.ts';
import { getExportAdapter } from '@core/import-export/registry.ts';
import type { CpsExportOptions, FormatId } from '@core/import-export/types.ts';
import { listCpsExportFileNames } from '../services/buildCpsExportService.ts';
import { useProjects } from '../state/useProjects.ts';

function staticExportFileNames(
  formatId: FormatId,
  profileId: string,
  exportProfileId?: string,
): string[] {
  try {
    const adapter = getExportAdapter(formatId);
    if (isMultiFileExportAdapter(adapter)) return [...adapter.fileNames];
    if (isSingleFileCpsExportAdapter(adapter)) {
      return [adapter.defaultFileName(exportProfileId ?? profileId)];
    }
    return [];
  } catch {
    return [];
  }
}

/** Resolved CPS export file list for multi-file builds (includes conditional files). */
export function useBuildCpsExportFileNames(build: FormatBuild, exportOptions: CpsExportOptions) {
  const { activeProjectId } = useProjects();
  const fallbackFileNames = useMemo(
    () =>
      staticExportFileNames(build.formatId as FormatId, build.profileId, exportOptions.profileId),
    [build.formatId, build.profileId, exportOptions.profileId],
  );
  const [fileNames, setFileNames] = useState<string[]>(fallbackFileNames);

  const requestKey = useMemo(
    () =>
      JSON.stringify({
        projectId: activeProjectId,
        buildId: build.id,
        revision: build.revision,
        updatedAt: build.updatedAt,
        exportOptions,
      }),
    [activeProjectId, build.id, build.revision, build.updatedAt, exportOptions],
  );

  useEffect(() => {
    setFileNames(fallbackFileNames);
  }, [fallbackFileNames]);

  useEffect(() => {
    if (!activeProjectId) return;

    let cancelled = false;

    void listCpsExportFileNames(activeProjectId, build.id, exportOptions)
      .then((names) => {
        if (!cancelled) setFileNames([...names]);
      })
      .catch(() => {
        if (!cancelled) setFileNames(fallbackFileNames);
      });

    return () => {
      cancelled = true;
    };
  }, [activeProjectId, build.id, requestKey, exportOptions, fallbackFileNames]);

  return fileNames;
}
