import type { AssembledBuild } from '@core/services/assemble.ts';
import {
  isMultiFileExportAdapter,
  isSingleFileCpsExportAdapter,
  type MultiFileExportAdapter,
} from './exportAdapter.ts';
import { getExportAdapter } from './registry.ts';
import type { FormatId, CpsExportOptions } from './types.ts';

/** Ordered CPS file names for a build projection — static manifest plus conditional files. */
export function resolveEffectiveExportFileNames(
  formatId: FormatId,
  assembled: AssembledBuild,
  options?: CpsExportOptions,
): readonly string[] {
  const adapter = getExportAdapter(formatId);
  if (isMultiFileExportAdapter(adapter)) {
    return resolveMultiFileExportFileNames(adapter, assembled, options);
  }
  if (isSingleFileCpsExportAdapter(adapter)) {
    const profileId = assembled.profileId ?? '';
    return [adapter.defaultFileName(profileId)];
  }
  return [];
}

function resolveMultiFileExportFileNames(
  adapter: MultiFileExportAdapter,
  assembled: AssembledBuild,
  options?: CpsExportOptions,
): readonly string[] {
  return adapter.resolveExportFileNames?.(assembled, options) ?? [...adapter.fileNames];
}
