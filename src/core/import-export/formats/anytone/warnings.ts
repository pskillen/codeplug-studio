import type { AssembledBuild } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';

export function collectAnytoneExportWarnings(
  _assembled: AssembledBuild,
  _library: LibrarySlice,
  _options?: CpsExportOptions,
): string[] {
  return [];
}
