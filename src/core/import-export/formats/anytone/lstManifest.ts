/**
 * Canonical AT-D890UV CPS manifest order (export-all).
 * Source: test-data/anytone/at-d890uv/meep.LST
 */
import { ANYTONE_CSV_LINE_ENDING } from './csvWrite.ts';
export const ANYTONE_CPS_MANIFEST_ORDER = [
  'Channel.CSV',
  'RadioIDList.CSV',
  'DMRZone.CSV',
  'ScanList.CSV',
  'AnalogAddressBook.CSV',
  'DMRTalkGroups.CSV',
  'PrefabricatedSMS.CSV',
  'FM.CSV',
  'DMRReceiveGroupCallList.CSV',
  '5ToneEncode.CSV',
  '2ToneEncode.CSV',
  'DTMFEncode.CSV',
  'HotKey_QuickCall.CSV',
  'HotKey_State.CSV',
  'HotKey_HotKey.CSV',
  'DMRDigitalContactList.CSV',
  'AutoRepeaterOffsetFrequencys.CSV',
  'RoamingChannel.CSV',
  'RoamingZone.CSV',
  'APRS.CSV',
  'GPSRoaming.CSV',
  'OptionalSetting.CSV',
  'AlertTone.CSV',
  'NXEncryptionCode.CSV',
  'NXStateMSG.CSV',
  'NXReceiveGroupCallList.CSV',
  'NXTalkGroup.CSV',
  'AMAir.CSV',
  'AESEncryptionCode.CSV',
  'ARC4EncryptionCode.CSV',
  'AMZone.CSV',
  'NXDigitalContactList.CSV',
  'TalkGroupWhitelist(Repeater).CSV',
  'DigitalContactWhitelist(Repeater).CSV',
  'NXSetting.CSV',
  'MDC1200AddressBook.CSV',
  'MDC1200Encode.CSV',
  'EncryptionCode.CSV',
] as const;

const MANIFEST_INDEX_BY_FILE = new Map<string, number>(
  ANYTONE_CPS_MANIFEST_ORDER.map((fileName, index) => [fileName, index]),
);

/** Lowercase slug stem for `{stem}.LST` from project display name. */
export function sanitiseLstProjectStem(projectName: string): string {
  const slug = projectName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9_-]/g, '');
  return slug || 'export';
}

/** Manifest filename for a project (e.g. `meep.LST`). */
export function anytoneLstFileName(projectName: string): string {
  return `${sanitiseLstProjectStem(projectName)}.LST`;
}

export function isAnytoneLstFileName(fileName: string, projectName: string | undefined): boolean {
  if (!projectName?.trim()) return false;
  return fileName === anytoneLstFileName(projectName);
}

/** Ordered manifest entries using canonical CPS indices (Approach A). */
export function orderExportedFilesForManifest(exportedCsvFiles: readonly string[]): {
  index: number;
  fileName: string;
}[] {
  const unique = new Set(
    exportedCsvFiles.filter((name) => !name.endsWith('.LST') && MANIFEST_INDEX_BY_FILE.has(name)),
  );
  return [...unique]
    .map((fileName) => ({
      index: MANIFEST_INDEX_BY_FILE.get(fileName)!,
      fileName,
    }))
    .sort((a, b) => a.index - b.index);
}

/** Serialise `.LST` manifest body for exported CSV members only. */
export function serialiseAnytoneLstManifest(exportedCsvFiles: readonly string[]): string {
  const entries = orderExportedFilesForManifest(exportedCsvFiles);
  const lines = [
    String(entries.length),
    ...entries.map(({ index, fileName }) => `${index},"${fileName}"`),
  ];
  return `${lines.join(ANYTONE_CSV_LINE_ENDING)}${ANYTONE_CSV_LINE_ENDING}`;
}
