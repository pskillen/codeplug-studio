/**
 * OpenGD77 / OpenUV380 debug archive: model table, radio-type names, FirmwareInfo identity and
 * coverage classification. Identity comes only from the raw FirmwareInfo sidecar; a selected
 * profile or a manifest `firmware` string is never evidence. A capture is never claimed to be a
 * full flash image. Wire facts: docs/reference/radios/opengd77/debug-capture.md.
 */
import type { RadioBackupManifestV1 } from '../../backup/types.ts';
import {
  OPENGD77_BACKUP_FLASH_SPANS,
  OPENGD77_BACKUP_USER_DATABASE_ID,
} from './backupRestoreRoles.ts';
import {
  DM1701_RADIO_TYPES,
  MD9600_RADIO_TYPES,
  OPENGD77_1701_POWER_STEPS,
  OPENGD77_MD9600_POWER_STEPS,
  OPENUV380_USER_DB_HEADER_ABS,
  OPENUV380_USER_DB_HEADER_SIZE,
  type OpenGd77PowerStep,
} from './constants.ts';
import { OPENGD77_DEBUG_FIRMWARE_INFO_SIDECAR } from './debugCapture.ts';
import { OPENGD77_DM1701_DESCRIPTOR } from './dm1701/descriptor.ts';
import { OPENGD77_DM1701_MODEL_ID, OPENGD77_MD9600_MODEL_ID } from './hydration.ts';
import { OPENGD77_MD9600_DESCRIPTOR } from './md9600/descriptor.ts';
import { OPENGD77_FIRMWARE_INFO_SIZE, parseFirmwareInfo } from './protocol.ts';

export interface OpenGd77DebugModel {
  modelId: string;
  label: string;
  radioTypes: readonly number[];
  powerSteps: readonly OpenGd77PowerStep[];
}

/** Debug-page models, keyed by canonical model id. */
export const OPENGD77_DEBUG_MODELS: Readonly<Record<string, OpenGd77DebugModel>> = {
  [OPENGD77_DM1701_MODEL_ID]: {
    modelId: OPENGD77_DM1701_MODEL_ID,
    label: 'DM-1701 / RT-84',
    radioTypes: DM1701_RADIO_TYPES,
    powerSteps: OPENGD77_1701_POWER_STEPS,
  },
  [OPENGD77_MD9600_MODEL_ID]: {
    modelId: OPENGD77_MD9600_MODEL_ID,
    label: 'MD-9600 / RT-90',
    radioTypes: MD9600_RADIO_TYPES,
    powerSteps: OPENGD77_MD9600_POWER_STEPS,
  },
};

const ALIASES: Readonly<Record<string, string>> = Object.fromEntries([
  ...OPENGD77_DM1701_DESCRIPTOR.modelIds.map((id) => [id, OPENGD77_DM1701_MODEL_ID]),
  ...OPENGD77_MD9600_DESCRIPTOR.modelIds.map((id) => [id, OPENGD77_MD9600_MODEL_ID]),
]);

/** Whether the id is any alias of a model the OpenGD77 debug pages cover. */
export const isOpenGd77ModelId = (id: string): boolean => Object.hasOwn(ALIASES, id);

/** Resolve any alias (for example `RT-84`) to its model entry. */
export function openGd77DebugModel(modelId: string): OpenGd77DebugModel | undefined {
  return Object.hasOwn(ALIASES, modelId) ? OPENGD77_DEBUG_MODELS[ALIASES[modelId]!] : undefined;
}

const hex = (n: number, digits = 2) => `0x${n.toString(16).padStart(digits, '0')}`;

/** Other codes named in protocol.md; they have no debug page. */
const OTHER_RADIO_TYPES: Readonly<Record<number, string>> = {
  0x00: 'Radioddity GD-77',
  0x01: 'Radioddity GD-77S',
  0x02: 'Baofeng DM-1801',
  0x03: 'Radioddity RD-5R',
  0x04: 'Baofeng DM-1801A',
  0x06: 'TYT MD-UV390',
  0x07: 'TYT MD-380',
  0x09: 'TYT MD-2017',
};

/** Radio types are shared by look-alikes, so the label never picks one of a pair. */
export function describeOpenGd77RadioType(radioType: number): string {
  if (radioType === 0x05) return 'MD-9600 / RT-90';
  if (radioType === 0x08) return 'DM-1701 / RT-84';
  if (radioType === 0x0a) return 'DM-1701 / RT-84 (RGB display)';
  const other = OTHER_RADIO_TYPES[radioType];
  if (other) return `${other} (no debug page)`;
  return `Unrecognised radio type ${hex(radioType)}`;
}

export type OpenGd77DebugIdentity =
  | {
      status: 'ok';
      structVersion: number;
      radioType: number;
      radioTypeLabel: string;
      revision: string;
      buildDate: string;
      flashId: number;
      features: number;
      featureBits: {
        inverseVideo: boolean;
        dmrIdDatabaseNLocation: boolean;
        voicePromptsLoaded: boolean;
      };
    }
  | { status: 'invalid'; reason: string };

/** Identity as reported by the raw FirmwareInfo sidecar; undefined when there is no sidecar. */
export function openGd77DebugIdentity(
  sidecars: Record<string, Uint8Array>,
): OpenGd77DebugIdentity | undefined {
  const raw = sidecars[OPENGD77_DEBUG_FIRMWARE_INFO_SIDECAR];
  if (!raw) return undefined;
  if (raw.length !== OPENGD77_FIRMWARE_INFO_SIZE) {
    return {
      status: 'invalid',
      reason: `FirmwareInfo is ${raw.length} bytes, expected ${OPENGD77_FIRMWARE_INFO_SIZE}`,
    };
  }
  const info = parseFirmwareInfo(raw);
  return {
    status: 'ok',
    structVersion: info.structVersion,
    radioType: info.radioType,
    radioTypeLabel: describeOpenGd77RadioType(info.radioType),
    revision: info.fwRevision,
    buildDate: info.buildDate,
    flashId: info.flashId,
    features: info.features,
    featureBits: {
      inverseVideo: (info.features & 0x01) !== 0,
      dmrIdDatabaseNLocation: (info.features & 0x02) !== 0,
      voicePromptsLoaded: (info.features & 0x04) !== 0,
    },
  };
}

export type OpenGd77SpanState = 'captured' | 'partial' | 'missing';

export interface OpenGd77SpanCoverage {
  id: string;
  label: string;
  start: number;
  length: number;
  state: OpenGd77SpanState;
  capturedBytes: number;
}

export interface OpenGd77UserDatabaseCoverage {
  state: 'captured' | 'not-captured';
  byteLength: number;
  /** Header plus packed entries: not one contiguous flash range (segment 1 lives elsewhere). */
  packed: true;
  /** Only the 12 header bytes: no valid `Id` header, or no entries. */
  headerOnly: boolean;
}

export interface OpenGd77UnclassifiedRegion {
  id: string;
  address: number;
  byteLength: number;
  role: string;
  path: string;
  reason: string;
}

export interface OpenGd77DebugCoverage {
  spans: OpenGd77SpanCoverage[];
  /** Unread flash between registered spans (`start` inclusive, `end` exclusive). Never read. */
  gaps: { start: number; end: number }[];
  userDatabase: OpenGd77UserDatabaseCoverage;
  unclassified: OpenGd77UnclassifiedRegion[];
  /** The flash part id as the radio reported it; absent without a valid FirmwareInfo sidecar. */
  flashPart?: string;
}

/** Classify a manifest's regions against the registered spans. Never reads outside them. */
export function classifyOpenGd77DebugCoverage(
  manifest: RadioBackupManifestV1,
  regions: Record<string, Uint8Array>,
  sidecars: Record<string, Uint8Array> = {},
): OpenGd77DebugCoverage {
  const unclassified: OpenGd77UnclassifiedRegion[] = [];
  const claimed = new Set<string>();
  const bytesOf = (id: string, declared: number) => Math.min(declared, regions[id]?.length ?? 0);

  const spans = OPENGD77_BACKUP_FLASH_SPANS.map((span): OpenGd77SpanCoverage => {
    const region = manifest.regions.find(
      (r) => r.id === span.id && r.address === span.start && r.path === `regions/${span.id}.bin`,
    );
    if (region) claimed.add(region.id);
    const capturedBytes = region ? Math.min(bytesOf(region.id, region.byteLength), span.length) : 0;
    return {
      id: span.id,
      label: span.label,
      start: span.start,
      length: span.length,
      capturedBytes,
      state: capturedBytes === 0 ? 'missing' : capturedBytes < span.length ? 'partial' : 'captured',
    };
  });

  const gaps: { start: number; end: number }[] = [];
  for (let i = 1; i < OPENGD77_BACKUP_FLASH_SPANS.length; i++) {
    const prev = OPENGD77_BACKUP_FLASH_SPANS[i - 1]!;
    const next = OPENGD77_BACKUP_FLASH_SPANS[i]!;
    if (next.start > prev.start + prev.length) {
      gaps.push({ start: prev.start + prev.length, end: next.start });
    }
  }

  const db = manifest.regions.find(
    (r) =>
      r.id === OPENGD77_BACKUP_USER_DATABASE_ID &&
      r.address === OPENUV380_USER_DB_HEADER_ABS &&
      r.path === `regions/${OPENGD77_BACKUP_USER_DATABASE_ID}.bin` &&
      r.restoreRole === 'inspect-only',
  );
  if (db) claimed.add(db.id);
  const dbBytes = db ? bytesOf(db.id, db.byteLength) : 0;
  const userDatabase: OpenGd77UserDatabaseCoverage = {
    state: dbBytes >= OPENUV380_USER_DB_HEADER_SIZE ? 'captured' : 'not-captured',
    byteLength: dbBytes,
    packed: true,
    headerOnly: dbBytes === OPENUV380_USER_DB_HEADER_SIZE,
  };

  for (const region of manifest.regions) {
    if (claimed.has(region.id)) continue;
    const known =
      OPENGD77_BACKUP_FLASH_SPANS.some((s) => s.id === region.id) ||
      region.id === OPENGD77_BACKUP_USER_DATABASE_ID;
    unclassified.push({
      id: region.id,
      address: region.address,
      byteLength: region.byteLength,
      role: region.restoreRole,
      path: region.path,
      reason: known
        ? 'address, path or role does not match the registered entry'
        : 'not a registered span or the User Database',
    });
  }

  const identity = openGd77DebugIdentity(sidecars);
  return {
    spans,
    gaps,
    userDatabase,
    unclassified,
    ...(identity?.status === 'ok'
      ? { flashPart: `Flash ID ${hex(identity.flashId, 4)} (as reported)` }
      : {}),
  };
}
