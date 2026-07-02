import type { MultiFileExportAdapter } from '@core/import-export/exportAdapter.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import {
  serialiseOpenGd77Files,
  type OpenGd77ExportFileName,
} from './serialise.ts';
import { collectOpenGd77ExportWarnings } from './warnings.ts';

export const OPENGD77_EXPORT_FILE_NAMES = [
  'Channels.csv',
  'Zones.csv',
  'Contacts.csv',
  'TG_Lists.csv',
  'DTMF.csv',
  'APRS.csv',
] as const satisfies readonly OpenGd77ExportFileName[];

export const opengd77ExportAdapter: MultiFileExportAdapter = {
  id: 'opengd77',
  label: 'OpenGD77 CPS CSV',
  status: 'shipped',
  delivery: 'multi-file',
  fileNames: OPENGD77_EXPORT_FILE_NAMES,
  serialiseFile(assembled, fileName, options?: CpsExportOptions) {
    const warnings = collectOpenGd77ExportWarnings(assembled, options);
    const files = serialiseOpenGd77Files(assembled, options);
    const content = files[fileName as OpenGd77ExportFileName];
    if (content === undefined) {
      throw new Error(`Unknown OpenGD77 export file: ${fileName}`);
    }
    return { content, warnings };
  },
};
