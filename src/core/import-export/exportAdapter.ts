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

/** CPS single-file export (CHIRP memory CSV). */
export interface SingleFileCpsExportAdapter extends BaseExportAdapter {
  readonly delivery: 'single-file-cps';
  defaultFileName(profileId: string): string;
  serialise(
    assembled: AssembledBuild,
    options?: CpsExportOptions,
  ): ExportResult & { content: string };
}

/** CPS multi-file export (Phase 4+). */
export interface MultiFileExportAdapter extends BaseExportAdapter {
  readonly delivery: 'multi-file';
  readonly fileNames: readonly string[];
  /** When set, overrides static `fileNames` per assembled build (e.g. conditional receive banks). */
  resolveExportFileNames?(assembled: AssembledBuild, options?: CpsExportOptions): readonly string[];
  /** Build-wide export warnings (profile caps, wire name limits, …). */
  collectExportWarnings(assembled: AssembledBuild, options?: CpsExportOptions): string[];
  serialiseFile(
    assembled: AssembledBuild,
    fileName: string,
    options?: CpsExportOptions,
  ): ExportResult & { content: string };
}

export type ExportAdapter =
  SingleFileProjectExportAdapter | SingleFileCpsExportAdapter | MultiFileExportAdapter;

export function isSingleFileProjectExportAdapter(
  adapter: ExportAdapter,
): adapter is SingleFileProjectExportAdapter {
  return adapter.delivery === 'single-file';
}

export function isSingleFileCpsExportAdapter(
  adapter: ExportAdapter,
): adapter is SingleFileCpsExportAdapter {
  return adapter.delivery === 'single-file-cps';
}

export function isMultiFileExportAdapter(
  adapter: ExportAdapter,
): adapter is MultiFileExportAdapter {
  return adapter.delivery === 'multi-file';
}

export type { ProjectAggregate };
