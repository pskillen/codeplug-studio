import { unzipSync, strFromU8 } from 'fflate';
import {
  applyNeonplugAprsRadioSettingsPatch,
  type NeonplugAprsRadioSettingsPatch,
} from './aprsSettingsWire.ts';
import { NEONPLUG_CODEPLUG_VERSION, NEONPLUG_JSON_FILE_NAME } from './serialise.ts';
import type { NeonplugCodeplugData, NeonplugRadioInfo } from './wireTypes.ts';

export interface NeonplugParseResult {
  data: NeonplugCodeplugData;
  warnings: string[];
}

export interface NeonplugMergeResult {
  data: NeonplugCodeplugData;
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Loose parse of NeonPlug `CodeplugData` from JSON — retain opaque bags as-is.
 * Does not validate every channel field; merge/export trusts Studio projection for modelled keys.
 */
export function parseNeonplugCodeplugJson(raw: unknown): NeonplugCodeplugData {
  if (!isRecord(raw)) {
    throw new Error('NeonPlug codeplug.json must be a JSON object');
  }

  const radioInfoRaw = isRecord(raw.radioInfo) ? raw.radioInfo : {};
  const radioInfo: NeonplugRadioInfo = {
    model: typeof radioInfoRaw.model === 'string' ? radioInfoRaw.model : '',
    firmware: typeof radioInfoRaw.firmware === 'string' ? radioInfoRaw.firmware : undefined,
    buildDate: typeof radioInfoRaw.buildDate === 'string' ? radioInfoRaw.buildDate : undefined,
    dspVersion: typeof radioInfoRaw.dspVersion === 'string' ? radioInfoRaw.dspVersion : undefined,
    radioVersion:
      typeof radioInfoRaw.radioVersion === 'string' ? radioInfoRaw.radioVersion : undefined,
    codeplugVersion:
      typeof radioInfoRaw.codeplugVersion === 'string' ? radioInfoRaw.codeplugVersion : undefined,
    maxContacts:
      typeof radioInfoRaw.maxContacts === 'number' ? radioInfoRaw.maxContacts : undefined,
    memoryLayout: isRecord(radioInfoRaw.memoryLayout)
      ? (radioInfoRaw.memoryLayout as NeonplugRadioInfo['memoryLayout'])
      : undefined,
    vframes: isRecord(radioInfoRaw.vframes)
      ? (radioInfoRaw.vframes as NeonplugRadioInfo['vframes'])
      : undefined,
  };

  return {
    version: typeof raw.version === 'string' ? raw.version : NEONPLUG_CODEPLUG_VERSION,
    exportDate: typeof raw.exportDate === 'string' ? raw.exportDate : new Date().toISOString(),
    channels: asArray(raw.channels) as NeonplugCodeplugData['channels'],
    zones: asArray(raw.zones) as NeonplugCodeplugData['zones'],
    scanLists: asArray(raw.scanLists) as NeonplugCodeplugData['scanLists'],
    contacts: asArray(raw.contacts) as NeonplugCodeplugData['contacts'],
    rxGroups: asArray(raw.rxGroups) as NeonplugCodeplugData['rxGroups'],
    radioIds: asArray(raw.radioIds) as NeonplugCodeplugData['radioIds'],
    quickContacts: asArray(raw.quickContacts),
    messages: asArray(raw.messages),
    digitalEmergencies: asArray(raw.digitalEmergencies),
    analogEmergencies: asArray(raw.analogEmergencies),
    encryptionKeys: asArray(raw.encryptionKeys),
    digitalEmergencyConfig: raw.digitalEmergencyConfig ?? null,
    radioSettings: raw.radioSettings ?? null,
    radioInfo,
  };
}

/** Unzip a `.neonplug` file and parse the required `codeplug.json` entry. */
export function parseNeonplugZip(bytes: Uint8Array): NeonplugParseResult {
  const warnings: string[] = [];
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new Error('Invalid .neonplug file: not a readable ZIP archive');
  }

  const rawEntry = entries[NEONPLUG_JSON_FILE_NAME];
  if (!rawEntry) {
    throw new Error(`Invalid .neonplug file: missing ${NEONPLUG_JSON_FILE_NAME}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(strFromU8(rawEntry));
  } catch {
    throw new Error(`Invalid .neonplug file: ${NEONPLUG_JSON_FILE_NAME} is not valid JSON`);
  }

  const data = parseNeonplugCodeplugJson(parsed);
  if (!data.radioInfo.model) {
    warnings.push('Donor .neonplug has empty radioInfo.model');
  }
  return { data, warnings };
}

export type NeonplugMergeOptions = {
  /** Override ISO exportDate for deterministic tests. */
  exportDate?: string;
  /** Expected NeonPlug radioInfo.model from Studio profile (e.g. DP570UV). */
  expectedRadioModel?: string;
  /**
   * Shallow APRS (+ related GPS) leaf patch from Studio model.
   * Applied onto retained donor `radioSettings`; no-op when donor settings are null.
   */
  aprsRadioSettingsPatch?: NeonplugAprsRadioSettingsPatch | null;
};

/**
 * Merge Studio projection into a radio-read donor CodeplugData.
 *
 * Studio overwrites: channels, zones, scanLists, contacts, rxGroups.
 * Donor retains: radioIds, quickContacts, radioSettings (then APRS patch), radioInfo,
 * messages, emergencies, encryptionKeys, digitalEmergencyConfig.
 */
export function mergeNeonplugCodeplug(
  base: NeonplugCodeplugData,
  projected: NeonplugCodeplugData,
  options?: NeonplugMergeOptions,
): NeonplugMergeResult {
  const warnings: string[] = [];
  const exportDate = options?.exportDate ?? new Date().toISOString();

  if (
    options?.expectedRadioModel &&
    base.radioInfo.model &&
    base.radioInfo.model !== options.expectedRadioModel
  ) {
    warnings.push(
      `Donor radioInfo.model is "${base.radioInfo.model}" but this build targets "${options.expectedRadioModel}"`,
    );
  }

  const radioSettings = applyNeonplugAprsRadioSettingsPatch(
    base.radioSettings,
    options?.aprsRadioSettingsPatch ?? null,
  );

  const data: NeonplugCodeplugData = {
    version: NEONPLUG_CODEPLUG_VERSION,
    exportDate,
    channels: projected.channels,
    zones: projected.zones,
    scanLists: projected.scanLists,
    contacts: projected.contacts,
    rxGroups: projected.rxGroups,
    // Always retain donor operator DMR IDs — Studio does not model them.
    radioIds: base.radioIds,
    quickContacts: base.quickContacts,
    messages: base.messages,
    digitalEmergencies: base.digitalEmergencies,
    analogEmergencies: base.analogEmergencies,
    encryptionKeys: base.encryptionKeys,
    digitalEmergencyConfig: base.digitalEmergencyConfig,
    radioSettings,
    radioInfo: base.radioInfo,
  };

  return { data, warnings };
}
