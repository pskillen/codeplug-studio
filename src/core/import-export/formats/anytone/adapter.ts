import type { MultiFileExportAdapter } from '@core/import-export/exportAdapter.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { ANYTONE_EXPORT_FILE_NAMES } from './columns.ts';
import { serialiseAnytoneFile, resolveAnytoneExportFileNames } from './serialise.ts';
import { collectAnytoneExportWarnings } from './warnings.ts';

function requireLibrary(library: LibrarySlice | undefined): LibrarySlice {
  if (!library) {
    throw new Error('Anytone export requires library slice on assembled build');
  }
  return library;
}

export const anytoneExportAdapter: MultiFileExportAdapter = {
  id: 'anytone',
  label: 'Anytone CPS CSV',
  status: 'shipped',
  delivery: 'multi-file',
  defaultExportSettings: {
    defaultScanInclusion: 'scan',
    expandModes: false,
    expandRxGroupLists: true,
    exportScratchChannels: true,
    exportZoneDerivedScanLists: false,
  },
  fileNames: [...ANYTONE_EXPORT_FILE_NAMES],
  resolveExportFileNames(assembled, options) {
    return resolveAnytoneExportFileNames(assembled, options);
  },
  collectExportWarnings(assembled, options?: CpsExportOptions) {
    const library = requireLibrary(assembled.library);
    return collectAnytoneExportWarnings(assembled, library, options);
  },
  serialiseFile(assembled, fileName, options?: CpsExportOptions) {
    const library = requireLibrary(assembled.library);
    const warnings: string[] = [];
    const content = serialiseAnytoneFile(assembled, library, fileName, options, warnings);
    return { content, warnings };
  },
};

export { ANYTONE_EXPORT_FILE_NAMES } from './columns.ts';
export { DEFAULT_ANYTONE_PROFILE_ID } from './profiles.ts';
