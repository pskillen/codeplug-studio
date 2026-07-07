import type { AssembledBuild } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import type { AnytoneExportFileName } from './columns.ts';
import { ANYTONE_EXPORT_FILE_NAMES } from './columns.ts';
import { formatCsv } from './csvWrite.ts';
import {
  CHANNEL_HEADERS,
  DIGITAL_CONTACT_HEADERS,
  RADIO_ID_HEADERS,
  RX_GROUP_LIST_HEADERS,
  SCAN_LIST_HEADERS,
  TALK_GROUP_HEADERS,
  ZONE_HEADERS,
} from './columns.ts';

const HEADER_ONLY: Record<AnytoneExportFileName, string[]> = {
  'Channel.CSV': CHANNEL_HEADERS,
  'DMRZone.CSV': ZONE_HEADERS,
  'ScanList.CSV': SCAN_LIST_HEADERS,
  'DMRTalkGroups.CSV': TALK_GROUP_HEADERS,
  'DMRDigitalContactList.CSV': DIGITAL_CONTACT_HEADERS,
  'DMRReceiveGroupCallList.CSV': RX_GROUP_LIST_HEADERS,
  'RadioIDList.CSV': RADIO_ID_HEADERS,
};

/** Serialise one CPS file from assembled build — stub until export adapter slice ships. */
export function serialiseAnytoneFile(
  _assembled: AssembledBuild,
  _library: LibrarySlice,
  fileName: string,
  _options?: CpsExportOptions,
  _warnings?: string[],
): string {
  if (!ANYTONE_EXPORT_FILE_NAMES.includes(fileName as AnytoneExportFileName)) {
    throw new Error(`Unknown Anytone export file: ${fileName}`);
  }
  const headers = HEADER_ONLY[fileName as AnytoneExportFileName];
  return formatCsv(headers, []);
}
