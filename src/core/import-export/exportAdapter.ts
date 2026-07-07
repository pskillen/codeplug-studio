import type { ProjectAggregate } from './projectDocument.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import type {
  ExportResult,
  ExportSerialiseResult,
  FormatExportDefaults,
  FormatId,
  FormatStatus,
  CpsExportOptions,
} from './types.ts';

export interface BaseExportAdapter {
  readonly id: FormatId;
  readonly label: string;
  readonly status: FormatStatus;
  readonly defaultExportSettings?: FormatExportDefaults;
}

/** Full-project single-file interchange (native YAML). */
export interface SingleFileProjectExportAdapter extends BaseExportAdapter {
  readonly delivery: 'single-file';
  readonly defaultFileName: string;
  serialise(aggregate: ProjectAggregate): ExportSerialiseResult;
}

/** CPS multi-file export (Phase 4+). */
export interface MultiFileExportAdapter extends BaseExportAdapter {
  readonly delivery: 'multi-file';
  readonly fileNames: readonly string[];
  serialiseFile(
    assembled: AssembledBuild,
    fileName: string,
    options?: CpsExportOptions,
  ): ExportResult & { content: string };
}

export type ExportAdapter = SingleFileProjectExportAdapter | MultiFileExportAdapter;

export function isSingleFileProjectExportAdapter(
  adapter: ExportAdapter,
): adapter is SingleFileProjectExportAdapter {
  return adapter.delivery === 'single-file';
}

export function isMultiFileExportAdapter(
  adapter: ExportAdapter,
): adapter is MultiFileExportAdapter {
  return adapter.delivery === 'multi-file';
}

export type { ProjectAggregate };
