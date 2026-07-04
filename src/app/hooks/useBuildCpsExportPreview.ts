import { useEffect, useMemo, useState } from 'react';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import { csvToTable, type CsvTable } from '@core/import-export/csvParse.ts';
import { isMultiFileExportAdapter } from '@core/import-export/exportAdapter.ts';
import { getExportAdapter } from '@core/import-export/registry.ts';
import type { CpsExportOptions, FormatId } from '@core/import-export/types.ts';
import { previewCpsExport } from '../services/buildCpsExportService.ts';
import { useProjects } from '../state/useProjects.ts';

export interface UseBuildCpsExportPreviewParams {
  build: FormatBuild;
  exportOptions: CpsExportOptions;
  enabled: boolean;
}

interface PreviewSnapshot {
  requestKey: string;
  files: Record<string, string>;
  warnings: string[];
  error: string | null;
}

export function useBuildCpsExportPreview({
  build,
  exportOptions,
  enabled,
}: UseBuildCpsExportPreviewParams) {
  const { activeProjectId } = useProjects();
  const [snapshot, setSnapshot] = useState<PreviewSnapshot | null>(null);

  const fileNames = useMemo(() => {
    try {
      const adapter = getExportAdapter(build.formatId as FormatId);
      if (!isMultiFileExportAdapter(adapter)) return [];
      return [...adapter.fileNames];
    } catch {
      return [];
    }
  }, [build.formatId]);

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
    if (!enabled || !activeProjectId) return;

    let cancelled = false;

    void previewCpsExport(activeProjectId, build.id, exportOptions)
      .then((result) => {
        if (cancelled) return;
        setSnapshot({
          requestKey,
          files: result.files,
          warnings: result.warnings,
          error: null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setSnapshot({
          requestKey,
          files: {},
          warnings: [],
          error: err instanceof Error ? err.message : String(err),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, activeProjectId, build.id, requestKey, exportOptions]);

  const isCurrentSnapshot = snapshot?.requestKey === requestKey;
  const files = isCurrentSnapshot ? snapshot.files : null;
  const warnings = isCurrentSnapshot ? snapshot.warnings : [];
  const error = isCurrentSnapshot ? snapshot.error : null;
  const loading = enabled && !isCurrentSnapshot;

  const tablesByFile = useMemo(() => {
    if (!files) return {} as Record<string, CsvTable>;
    const tables: Record<string, CsvTable> = {};
    for (const [name, content] of Object.entries(files)) {
      tables[name] = csvToTable(content);
    }
    return tables;
  }, [files]);

  return {
    fileNames,
    tablesByFile,
    warnings,
    loading,
    error,
  };
}
