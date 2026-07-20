import { NEONPLUG_CODEPLUG_VERSION } from './serialise.ts';
import type {
  NeonplugCodeplugData,
  NeonplugRadioId,
  NeonplugRadioInfo,
} from './wireTypes.ts';

/**
 * Opaque NeonPlug donor slices retained on merge — export-boundary escape hatch only.
 * Not library entities; not wire-stash for modelled channels/zones/contacts.
 */
export type NeonplugDonorRetainSlices = Pick<
  NeonplugCodeplugData,
  | 'radioIds'
  | 'quickContacts'
  | 'messages'
  | 'digitalEmergencies'
  | 'analogEmergencies'
  | 'encryptionKeys'
  | 'digitalEmergencyConfig'
  | 'radioSettings'
  | 'radioInfo'
>;

/**
 * Build-persisted NeonPlug donor bag (`FormatBuild.neonplugDonor`).
 * Browser storage only — never commit operator settings into the repo.
 */
export interface NeonplugDonorBag {
  /** Original upload file name when known. */
  sourceFileName?: string;
  /** ISO timestamp when the retain bag was captured. */
  capturedAt: string;
  /** Unmodelled CodeplugData slices for merge. */
  retain: NeonplugDonorRetainSlices;
}

/** Read-only summary for inspect UI — never includes encryption key material. */
export interface NeonplugDonorRetainSummary {
  radioInfo: NeonplugRadioInfo;
  radioIdCount: number;
  radioIds: NeonplugRadioId[];
  quickContactCount: number;
  messageCount: number;
  digitalEmergencyCount: number;
  analogEmergencyCount: number;
  encryptionKeyCount: number;
  hasDigitalEmergencyConfig: boolean;
  hasRadioSettings: boolean;
  /** Shallow, safe radioSettings keys (string/number/boolean leaf values only). */
  radioSettingsPreview: Record<string, string | number | boolean>;
}

/** Extract retain-from-base slices from parsed CodeplugData. */
export function extractNeonplugDonorRetain(
  data: NeonplugCodeplugData,
  meta?: { sourceFileName?: string; capturedAt?: string },
): NeonplugDonorBag {
  return {
    sourceFileName: meta?.sourceFileName,
    capturedAt: meta?.capturedAt ?? new Date().toISOString(),
    retain: {
      radioIds: data.radioIds,
      quickContacts: data.quickContacts,
      messages: data.messages,
      digitalEmergencies: data.digitalEmergencies,
      analogEmergencies: data.analogEmergencies,
      encryptionKeys: data.encryptionKeys,
      digitalEmergencyConfig: data.digitalEmergencyConfig,
      radioSettings: data.radioSettings,
      radioInfo: data.radioInfo,
    },
  };
}

/**
 * Rehydrate a merge base from stored retain slices.
 * Modelled arrays are empty — `mergeNeonplugCodeplug` overwrites them from Studio projection.
 */
export function neonplugDonorRetainAsMergeBase(
  bag: NeonplugDonorBag,
  exportDate?: string,
): NeonplugCodeplugData {
  const { retain } = bag;
  return {
    version: NEONPLUG_CODEPLUG_VERSION,
    exportDate: exportDate ?? bag.capturedAt,
    channels: [],
    zones: [],
    scanLists: [],
    contacts: [],
    rxGroups: [],
    radioIds: retain.radioIds,
    quickContacts: retain.quickContacts,
    messages: retain.messages,
    digitalEmergencies: retain.digitalEmergencies,
    analogEmergencies: retain.analogEmergencies,
    encryptionKeys: retain.encryptionKeys,
    digitalEmergencyConfig: retain.digitalEmergencyConfig,
    radioSettings: retain.radioSettings,
    radioInfo: retain.radioInfo,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/** Safe shallow preview of radioSettings — skips nested objects/arrays (VFOs, etc.). */
export function summariseNeonplugRadioSettings(
  radioSettings: unknown | null,
): Record<string, string | number | boolean> {
  if (!isRecord(radioSettings)) return {};
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(radioSettings)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    }
  }
  return out;
}

/** Build a UI-safe summary — encryption keys are counted only. */
export function summariseNeonplugDonorRetain(bag: NeonplugDonorBag): NeonplugDonorRetainSummary {
  const { retain } = bag;
  return {
    radioInfo: retain.radioInfo,
    radioIdCount: retain.radioIds.length,
    radioIds: retain.radioIds,
    quickContactCount: retain.quickContacts.length,
    messageCount: retain.messages.length,
    digitalEmergencyCount: retain.digitalEmergencies.length,
    analogEmergencyCount: retain.analogEmergencies.length,
    encryptionKeyCount: retain.encryptionKeys.length,
    hasDigitalEmergencyConfig: retain.digitalEmergencyConfig != null,
    hasRadioSettings: retain.radioSettings != null,
    radioSettingsPreview: summariseNeonplugRadioSettings(retain.radioSettings),
  };
}
