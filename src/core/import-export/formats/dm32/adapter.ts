import type { MultiFileExportAdapter } from '@core/import-export/exportAdapter.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { serialiseDm32Files, DM32_EXPORT_FILE_NAMES } from './serialise.ts';
import { collectDm32ExportWarnings } from './warnings.ts';

function requireLibrary(library: LibrarySlice | undefined): LibrarySlice {
  if (!library) {
    throw new Error('DM32 export requires library slice on assembled build');
  }
  return library;
}

export const dm32ExportAdapter: MultiFileExportAdapter = {
  id: 'dm32',
  label: 'Baofeng DM32 CPS CSV',
  status: 'shipped',
  delivery: 'multi-file',
  defaultExportSettings: {
    defaultScanInclusion: 'scan',
    expandModes: false,
    expandRxGroupLists: true,
    exportScratchChannels: true,
    exportZoneDerivedScanLists: true,
  },
  fileNames: DM32_EXPORT_FILE_NAMES,
  collectExportWarnings(assembled, options?: CpsExportOptions) {
    const library = requireLibrary(assembled.library);
    return collectDm32ExportWarnings(assembled, library, options);
  },
  serialiseFile(assembled, fileName, options?: CpsExportOptions) {
    const library = requireLibrary(assembled.library);
    const warnings: string[] = [];
    const files = serialiseDm32Files(assembled, library, options, warnings);
    const content = files[fileName as keyof typeof files];
    if (content === undefined) {
      throw new Error(`Unknown DM32 export file: ${fileName}`);
    }
    return { content, warnings };
  },
};

export { DM32_EXPORT_FILE_NAMES };
