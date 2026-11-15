/**
 * Versioned radio-backup zip contract (pack/parse only).
 * Not a CPS format. Never persist on the project; never import Radio Info zips.
 */

export type RadioBackupRegionRole = 'restorable' | 'inspect-only';

export type RadioBackupCapturedVia = 'web-serial' | 'android-usb-serial' | 'file';

export type RadioBackupCoverage = 'full-clone' | 'known-map-regions' | 'partial';

export const RADIO_BACKUP_FORMAT = 'codeplug-studio-radio-backup' as const;
export const RADIO_BACKUP_VERSION = 1 as const;

export interface RadioBackupRegionV1 {
  id: string;
  label: string;
  address: number;
  byteLength: number;
  /** Zip path under `regions/` (e.g. `regions/channels.bin`). */
  path: string;
  restoreRole: RadioBackupRegionRole;
}

export interface RadioBackupManifestV1 {
  format: typeof RADIO_BACKUP_FORMAT;
  version: typeof RADIO_BACKUP_VERSION;
  capturedAt: string;
  capturedVia: RadioBackupCapturedVia;
  app: { buildEnv: string; buildVersion: string };
  radioModelId: string;
  descriptorLabel: string;
  firmware?: string;
  serial?: string;
  coverage: RadioBackupCoverage;
  imageByteLength: number;
  regions: RadioBackupRegionV1[];
  restoreFragileAfterFactoryReset?: boolean;
  addressBase?: number;
  dm32ContactsBase?: number;
  dm32ContactsEnd?: number;
  /** Operator's own name for the radio. Descriptive only: never matched, never an identity check. */
  radioName?: string;
  /** Operator's short label for this backup. Descriptive only. */
  label?: string;
  /** Operator's free-text note about this backup. Descriptive only. */
  description?: string;
}

/** Operator-supplied descriptive fields shared by backups and debug captures. */
export interface RadioBackupLabels {
  radioName?: string;
  label?: string;
  description?: string;
}

export const RADIO_BACKUP_LABEL_FIELDS = ['radioName', 'label', 'description'] as const;
export type RadioBackupLabelField = (typeof RADIO_BACKUP_LABEL_FIELDS)[number];

/** Length caps, in characters, applied after trimming. */
export const RADIO_BACKUP_LABEL_MAX: Record<RadioBackupLabelField, number> = {
  radioName: 64,
  label: 80,
  description: 500,
};

/** Trim each field, cap its length, and drop blanks. Never throws. */
export function normaliseBackupLabels(input: RadioBackupLabels): RadioBackupLabels {
  const out: RadioBackupLabels = {};
  for (const field of RADIO_BACKUP_LABEL_FIELDS) {
    const text = input[field]?.trim().slice(0, RADIO_BACKUP_LABEL_MAX[field]).trim();
    if (text) out[field] = text;
  }
  return out;
}

export class RadioBackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RadioBackupError';
  }
}

const REGION_ROLES = new Set<RadioBackupRegionRole>(['restorable', 'inspect-only']);
const CAPTURED_VIA = new Set<RadioBackupCapturedVia>(['web-serial', 'android-usb-serial', 'file']);
const COVERAGES = new Set<RadioBackupCoverage>(['full-clone', 'known-map-regions', 'partial']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new RadioBackupError(`Radio backup manifest ${field} must be a non-empty string.`);
  }
  return value;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new RadioBackupError(`Radio backup manifest ${field} must be a string when present.`);
  }
  return value;
}

function requireNonNegativeInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new RadioBackupError(`Radio backup manifest ${field} must be a non-negative integer.`);
  }
  return value;
}

function optionalNonNegativeInt(value: unknown, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  return requireNonNegativeInt(value, field);
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    throw new RadioBackupError(`Radio backup manifest ${field} must be a boolean when present.`);
  }
  return value;
}

/** Zip member path must stay under `regions/` with no `.` / `..` segments. */
export function isRadioBackupRegionPath(path: string): boolean {
  if (!path.startsWith('regions/')) {
    return false;
  }
  const parts = path.split('/');
  if (parts[0] !== 'regions' || parts.length < 2) {
    return false;
  }
  return parts.every((part) => part.length > 0 && part !== '.' && part !== '..');
}

function validateRegion(raw: unknown, index: number): RadioBackupRegionV1 {
  if (!isRecord(raw)) {
    throw new RadioBackupError(`Radio backup manifest regions[${index}] must be an object.`);
  }
  const id = requireNonEmptyString(raw.id, `regions[${index}].id`);
  const label = requireNonEmptyString(raw.label, `regions[${index}].label`);
  const address = requireNonNegativeInt(raw.address, `regions[${index}].address`);
  const byteLength = requireNonNegativeInt(raw.byteLength, `regions[${index}].byteLength`);
  const path = requireNonEmptyString(raw.path, `regions[${index}].path`);
  if (!isRadioBackupRegionPath(path)) {
    throw new RadioBackupError(
      `Radio backup manifest regions[${index}].path must be under regions/.`,
    );
  }
  if (
    typeof raw.restoreRole !== 'string' ||
    !REGION_ROLES.has(raw.restoreRole as RadioBackupRegionRole)
  ) {
    throw new RadioBackupError(
      `Radio backup manifest regions[${index}].restoreRole must be restorable or inspect-only.`,
    );
  }
  return {
    id,
    label,
    address,
    byteLength,
    path,
    restoreRole: raw.restoreRole as RadioBackupRegionRole,
  };
}

/**
 * Fail-closed parse of unknown JSON into a v1 radio-backup manifest.
 * Region bin length checks belong in `parseRadioBackupZip`.
 */
export function validateRadioBackupManifest(value: unknown): RadioBackupManifestV1 {
  if (!isRecord(value)) {
    throw new RadioBackupError('Radio backup manifest must be an object.');
  }
  if (value.format !== RADIO_BACKUP_FORMAT) {
    throw new RadioBackupError(`Radio backup manifest format must be ${RADIO_BACKUP_FORMAT}.`);
  }
  if (value.version !== RADIO_BACKUP_VERSION) {
    throw new RadioBackupError('Radio backup manifest version must be 1.');
  }
  const capturedAt = requireNonEmptyString(value.capturedAt, 'capturedAt');
  if (
    typeof value.capturedVia !== 'string' ||
    !CAPTURED_VIA.has(value.capturedVia as RadioBackupCapturedVia)
  ) {
    throw new RadioBackupError(
      'Radio backup manifest capturedVia must be web-serial, android-usb-serial or file.',
    );
  }
  if (!isRecord(value.app)) {
    throw new RadioBackupError('Radio backup manifest app must be an object.');
  }
  const app = {
    buildEnv: requireNonEmptyString(value.app.buildEnv, 'app.buildEnv'),
    buildVersion: requireNonEmptyString(value.app.buildVersion, 'app.buildVersion'),
  };
  const radioModelId = requireNonEmptyString(value.radioModelId, 'radioModelId');
  const descriptorLabel = requireNonEmptyString(value.descriptorLabel, 'descriptorLabel');
  if (typeof value.coverage !== 'string' || !COVERAGES.has(value.coverage as RadioBackupCoverage)) {
    throw new RadioBackupError(
      'Radio backup manifest coverage must be full-clone, known-map-regions, or partial.',
    );
  }
  const imageByteLength = requireNonNegativeInt(value.imageByteLength, 'imageByteLength');
  if (!Array.isArray(value.regions)) {
    throw new RadioBackupError('Radio backup manifest regions must be an array.');
  }
  if (value.regions.length === 0) {
    throw new RadioBackupError('Radio backup manifest regions must not be empty.');
  }
  const regions = value.regions.map((region, index) => validateRegion(region, index));
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const region of regions) {
    if (ids.has(region.id)) {
      throw new RadioBackupError(`Radio backup manifest has duplicate region id ${region.id}.`);
    }
    ids.add(region.id);
    if (paths.has(region.path)) {
      throw new RadioBackupError(`Radio backup manifest has duplicate region path ${region.path}.`);
    }
    paths.add(region.path);
  }

  const manifest: RadioBackupManifestV1 = {
    format: RADIO_BACKUP_FORMAT,
    version: RADIO_BACKUP_VERSION,
    capturedAt,
    capturedVia: value.capturedVia as RadioBackupCapturedVia,
    app,
    radioModelId,
    descriptorLabel,
    coverage: value.coverage as RadioBackupCoverage,
    imageByteLength,
    regions,
  };

  const firmware = optionalString(value.firmware, 'firmware');
  if (firmware !== undefined) {
    manifest.firmware = firmware;
  }
  const serial = optionalString(value.serial, 'serial');
  if (serial !== undefined) {
    manifest.serial = serial;
  }
  const restoreFragileAfterFactoryReset = optionalBoolean(
    value.restoreFragileAfterFactoryReset,
    'restoreFragileAfterFactoryReset',
  );
  if (restoreFragileAfterFactoryReset !== undefined) {
    manifest.restoreFragileAfterFactoryReset = restoreFragileAfterFactoryReset;
  }
  const addressBase = optionalNonNegativeInt(value.addressBase, 'addressBase');
  if (addressBase !== undefined) {
    manifest.addressBase = addressBase;
  }
  const dm32ContactsBase = optionalNonNegativeInt(value.dm32ContactsBase, 'dm32ContactsBase');
  if (dm32ContactsBase !== undefined) {
    manifest.dm32ContactsBase = dm32ContactsBase;
  }
  const dm32ContactsEnd = optionalNonNegativeInt(value.dm32ContactsEnd, 'dm32ContactsEnd');
  if (dm32ContactsEnd !== undefined) {
    manifest.dm32ContactsEnd = dm32ContactsEnd;
  }

  // Older backups carry none of these; a present one must be a string. Over-long text is
  // shortened rather than refused so a hand-edited file still opens.
  for (const field of RADIO_BACKUP_LABEL_FIELDS) {
    const text = optionalString(value[field], field);
    if (text !== undefined) Object.assign(manifest, normaliseBackupLabels({ [field]: text }));
  }

  return manifest;
}
