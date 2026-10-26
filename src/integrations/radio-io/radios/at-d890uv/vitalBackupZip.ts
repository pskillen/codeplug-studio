/**
 * AT-D890UV vital-data zip (#1288). Distinct from the codeplug radio backup: its own `format` and
 * `kind: "d890-vital"`, so `parseRadioBackupZip` rejects it and this parser rejects a codeplug backup.
 */

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { RadioBackupError } from '../../backup/types.ts';
import { formatAtD890LocalInfoSerial } from './identityCheck.ts';
import { AT_D890_VITAL_UNIT_BYTES, type AtD890VitalUnitBytes } from './vitalBackup.ts';

export const AT_D890_VITAL_FORMAT = 'codeplug-studio-d890-vital-backup' as const;
export const AT_D890_VITAL_KIND = 'd890-vital' as const;
export const AT_D890_VITAL_VERSION = 1 as const;

export interface AtD890VitalManifestUnit {
  id: string;
  label: string;
  /** Address requested on the wire. */
  address: number;
  byteLength: number;
  /** Zip path, named by requested address, e.g. `units/04f00000.bin`. */
  path: string;
  sha256: string;
  /** The radio answered with another unit's bytes; this is not an independent copy. */
  asReturned: boolean;
  /** Set when these bytes equal another unit's bytes. */
  identicalTo?: string;
}

export interface AtD890VitalManifest {
  format: typeof AT_D890_VITAL_FORMAT;
  kind: typeof AT_D890_VITAL_KIND;
  version: typeof AT_D890_VITAL_VERSION;
  capturedAt: string;
  app: { buildEnv: string; buildVersion: string };
  radioModelId: string;
  serial: string;
  /** The 16 ident bytes, hex. */
  identHex: string;
  /** Ident byte 8, which equals LocalInfo +0x03 on hardware. */
  variant: number;
  firmware?: string;
  /** Number of full read passes compared byte for byte. */
  readPasses: number;
  bothReadsMatched: true;
  units: AtD890VitalManifestUnit[];
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(data));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function atD890VitalUnitPath(address: number): string {
  return `units/${address.toString(16).padStart(8, '0')}.bin`;
}

export interface BuildAtD890VitalManifestInput {
  units: readonly AtD890VitalUnitBytes[];
  ident: Uint8Array;
  firmware?: string;
  capturedAt: string;
  app: { buildEnv: string; buildVersion: string };
  radioModelId: string;
}

export async function buildAtD890VitalManifest(
  input: BuildAtD890VitalManifestInput,
): Promise<AtD890VitalManifest> {
  const localInfo = input.units.find((u) => u.def.id === 'local-info');
  if (!localInfo) throw new RadioBackupError('Vital data has no LocalInfo unit.');
  const units: AtD890VitalManifestUnit[] = [];
  const hashes: string[] = [];
  for (const u of input.units) hashes.push(await sha256Hex(u.bytes));
  input.units.forEach((u, i) => {
    const sha256 = hashes[i]!;
    const twin = input.units.findIndex((_o, j) => j < i && hashes[j] === sha256);
    units.push({
      id: u.def.id,
      label: u.def.label,
      address: u.def.address,
      byteLength: u.bytes.byteLength,
      path: atD890VitalUnitPath(u.def.address),
      sha256,
      asReturned: u.def.asReturned,
      ...(twin >= 0 ? { identicalTo: input.units[twin]!.def.id } : {}),
    });
  });
  return {
    format: AT_D890_VITAL_FORMAT,
    kind: AT_D890_VITAL_KIND,
    version: AT_D890_VITAL_VERSION,
    capturedAt: input.capturedAt,
    app: input.app,
    radioModelId: input.radioModelId,
    serial: formatAtD890LocalInfoSerial(localInfo.bytes),
    identHex: hex(input.ident),
    variant: input.ident[8] ?? 0,
    ...(input.firmware ? { firmware: input.firmware } : {}),
    readPasses: 2,
    bothReadsMatched: true,
    units,
  };
}

export function packAtD890VitalZip(
  manifest: AtD890VitalManifest,
  unitBytes: Record<string, Uint8Array>,
): Uint8Array {
  const entries: Record<string, Uint8Array> = {
    'manifest.json': strToU8(`${JSON.stringify(manifest, null, 2)}\n`),
  };
  for (const unit of manifest.units) {
    const bytes = unitBytes[unit.id];
    if (!(bytes instanceof Uint8Array) || bytes.byteLength !== unit.byteLength) {
      throw new RadioBackupError(`Vital pack is missing or mis-sized bytes for ${unit.id}.`);
    }
    entries[unit.path] = bytes;
  }
  return zipSync(entries);
}

export interface ParsedAtD890VitalZip {
  manifest: AtD890VitalManifest;
  units: Record<string, Uint8Array>;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown, field: string): string {
  if (typeof v !== 'string' || v.length === 0) {
    throw new RadioBackupError(`Vital backup manifest ${field} must be a non-empty string.`);
  }
  return v;
}

function int(v: unknown, field: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
    throw new RadioBackupError(`Vital backup manifest ${field} must be a non-negative integer.`);
  }
  return v;
}

/** Unzip, validate the manifest, and check every unit's length and SHA-256. */
export async function parseAtD890VitalZip(bytes: Uint8Array): Promise<ParsedAtD890VitalZip> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new RadioBackupError('Vital backup zip could not be read.');
  }
  const raw = entries['manifest.json'];
  if (!raw) throw new RadioBackupError('Vital backup zip is missing manifest.json.');
  let json: unknown;
  try {
    json = JSON.parse(strFromU8(raw));
  } catch {
    throw new RadioBackupError('Vital backup manifest.json is not valid JSON.');
  }
  if (!isRecord(json) || json.format !== AT_D890_VITAL_FORMAT || json.kind !== AT_D890_VITAL_KIND) {
    throw new RadioBackupError(
      'This is not an AT-D890UV vital-data file. Codeplug backups open with Open backup file.',
    );
  }
  if (json.version !== AT_D890_VITAL_VERSION) {
    throw new RadioBackupError('Vital backup manifest version must be 1.');
  }
  if (!isRecord(json.app) || json.bothReadsMatched !== true || !Array.isArray(json.units)) {
    throw new RadioBackupError('Vital backup manifest is incomplete.');
  }
  const units: AtD890VitalManifestUnit[] = json.units.map((u: unknown, i: number) => {
    if (!isRecord(u)) throw new RadioBackupError(`Vital backup units[${i}] must be an object.`);
    const path = str(u.path, `units[${i}].path`);
    if (!/^units\/[0-9a-f]{8}\.bin$/.test(path)) {
      throw new RadioBackupError(`Vital backup units[${i}].path is not a unit path.`);
    }
    return {
      id: str(u.id, `units[${i}].id`),
      label: str(u.label, `units[${i}].label`),
      address: int(u.address, `units[${i}].address`),
      byteLength: int(u.byteLength, `units[${i}].byteLength`),
      path,
      sha256: str(u.sha256, `units[${i}].sha256`),
      asReturned: u.asReturned === true,
      ...(typeof u.identicalTo === 'string' ? { identicalTo: u.identicalTo } : {}),
    };
  });
  if (units.length === 0) throw new RadioBackupError('Vital backup has no units.');
  const manifest: AtD890VitalManifest = {
    format: AT_D890_VITAL_FORMAT,
    kind: AT_D890_VITAL_KIND,
    version: AT_D890_VITAL_VERSION,
    capturedAt: str(json.capturedAt, 'capturedAt'),
    app: {
      buildEnv: str(json.app.buildEnv, 'app.buildEnv'),
      buildVersion: str(json.app.buildVersion, 'app.buildVersion'),
    },
    radioModelId: str(json.radioModelId, 'radioModelId'),
    serial: typeof json.serial === 'string' ? json.serial : '',
    identHex: str(json.identHex, 'identHex'),
    variant: int(json.variant, 'variant'),
    ...(typeof json.firmware === 'string' ? { firmware: json.firmware } : {}),
    readPasses: int(json.readPasses, 'readPasses'),
    bothReadsMatched: true,
    units,
  };
  const out: Record<string, Uint8Array> = {};
  for (const unit of units) {
    const data = entries[unit.path];
    if (!data) throw new RadioBackupError(`Vital backup zip is missing ${unit.path}.`);
    if (data.byteLength !== unit.byteLength || data.byteLength !== AT_D890_VITAL_UNIT_BYTES) {
      throw new RadioBackupError(
        `Vital backup unit ${unit.id} is ${data.byteLength} bytes, expected ${AT_D890_VITAL_UNIT_BYTES}.`,
      );
    }
    if ((await sha256Hex(data)) !== unit.sha256) {
      throw new RadioBackupError(`Vital backup unit ${unit.id} does not match its SHA-256.`);
    }
    out[unit.id] = data;
  }
  return { manifest, units: out };
}
