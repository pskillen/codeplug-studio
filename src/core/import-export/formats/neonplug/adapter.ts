import type { MultiFileExportAdapter } from '@core/import-export/exportAdapter.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { NEONPLUG_JSON_FILE_NAME, serialiseNeonplugCodeplug } from './serialise.ts';
import { collectNeonplugExportWarnings } from './warnings.ts';

export const neonplugExportAdapter: MultiFileExportAdapter = {
  id: 'neonplug',
  label: 'NeonPlug',
  status: 'shipped',
  delivery: 'multi-file',
  defaultExportSettings: {
    defaultScanInclusion: 'scan',
    expandModes: false,
    expandRxGroupLists: true,
    exportScratchChannels: true,
  },
  fileNames: [NEONPLUG_JSON_FILE_NAME],
  collectExportWarnings(assembled, options?: CpsExportOptions) {
    return collectNeonplugExportWarnings(assembled, options);
  },
  serialiseFile(assembled, fileName, options?: CpsExportOptions) {
    if (fileName !== NEONPLUG_JSON_FILE_NAME) {
      throw new Error(`Unknown NeonPlug export file: ${fileName}`);
    }
    const result = serialiseNeonplugCodeplug(assembled, options);
    return { content: result.content, warnings: result.warnings };
  },
};

export { NEONPLUG_JSON_FILE_NAME };
