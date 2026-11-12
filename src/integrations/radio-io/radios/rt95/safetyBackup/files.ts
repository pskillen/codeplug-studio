/**
 * RT95 safety-backup files: the two manifests, the zip on disk, and the radio key.
 *
 * `full` is the firmware project's `rt95-full-backup` v1 (its restore tool reads it); `cal` is
 * `rt95-cal-backup` v1, the same keys over 0x3B00-0x3FFF. Both carry `serial`, the number the operator
 * typed from the radio's label: that, not anything read from the EEPROM, says which radio a backup is for.
 */
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { RadioProtocolError } from '../../../kit/errors.ts';
import { RT95_ALLOWED_MODEL } from '../constants.ts';
import { rt95SafetyRegionRange, rt95SafetySignatureOk, type Rt95SafetyRegion } from './reader.ts';

export const RT95_SAFETY_FORMAT = {
  cal: 'rt95-cal-backup',
  full: 'rt95-full-backup',
} as const;
export const RT95_SAFETY_MANIFEST_VERSION = 1;
export const RT95_SAFETY_RECORD_FAMILY = 'retevis-rt95';

export interface Rt95SafetyManifest {
  format: (typeof RT95_SAFETY_FORMAT)[Rt95SafetyRegion];
  version: 1;
  start: number;
  end: number;
  size: number;
  sha256: string;
  fingerprint: string;
  ident: { model: string; bandlimit: number; version: string };
  chip: '32KiB';
  signature_ok: true;
  passes: number;
  rereads: number[];
  /** Local time, ISO, seconds. */
  created: string;
  tool: string;
  tool_sha256: string;
  /** Normalised serial typed from the radio's label. */
  serial: string;
}

/** The key list the firmware tool's `rt95-full-backup` loader checks (plus `serial`). */
export const RT95_SAFETY_MANIFEST_KEYS = [
  'format',
  'version',
  'start',
  'end',
  'size',
  'sha256',
  'fingerprint',
  'ident',
  'chip',
  'signature_ok',
  'passes',
  'rereads',
  'created',
  'tool',
  'tool_sha256',
  'serial',
] as const;

/** Trim, uppercase and collapse inner whitespace. Empty means invalid (returns ''). */
export function normaliseRadioSerial(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toUpperCase();
}

/** The one place that says which radio a backup is for. */
export function rt95SafetyBackupRadioKey(serial: string): string {
  return normaliseRadioSerial(serial);
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(data));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** `YYYYmmdd-HHMMSS` in local time. */
export function rt95SafetyStamp(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/** `YYYY-mm-ddTHH:MM:SS` in local time. */
function localIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Serial reduced to `[A-Za-z0-9-]` for a file name. */
export function rt95SafetyFileSerial(serial: string): string {
  return (
    normaliseRadioSerial(serial)
      .replace(/[^A-Za-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'unknown'
  );
}

export function rt95SafetyBaseName(region: Rt95SafetyRegion, serial: string, date: Date): string {
  return `rt95-eeprom-${region}-${rt95SafetyFileSerial(serial)}-${rt95SafetyStamp(date)}`;
}

export interface BuildRt95SafetyManifestInput {
  region: Rt95SafetyRegion;
  bytes: Uint8Array;
  ident: { model: string; bandlimit: number; version: string };
  rereads: readonly number[];
  serial: string;
  now: Date;
  /** e.g. `codeplug-studio next abc1234`. */
  tool: string;
}

export async function buildRt95SafetyManifest(
  input: BuildRt95SafetyManifestInput,
): Promise<Rt95SafetyManifest> {
  const { start, end } = rt95SafetyRegionRange(input.region);
  const serial = normaliseRadioSerial(input.serial);
  if (!serial) throw new RadioProtocolError('A radio serial number is required.');
  if (input.bytes.length !== end - start + 1) {
    throw new RadioProtocolError('Safety backup bytes have the wrong size for the region.');
  }
  const sha256 = await sha256Hex(input.bytes);
  return {
    format: RT95_SAFETY_FORMAT[input.region],
    version: 1,
    start,
    end,
    size: input.bytes.length,
    sha256,
    fingerprint: sha256.slice(0, 8),
    ident: {
      model: input.ident.model,
      bandlimit: input.ident.bandlimit,
      version: input.ident.version,
    },
    chip: '32KiB',
    signature_ok: true,
    passes: 2,
    rereads: [...input.rereads],
    created: localIso(input.now),
    tool: input.tool,
    tool_sha256: '',
    serial,
  };
}

export function packRt95SafetyZip(
  manifest: Rt95SafetyManifest,
  bytes: Uint8Array,
  baseName: string,
): Uint8Array {
  return zipSync({
    [`${baseName}.bin`]: bytes,
    [`${baseName}.json`]: strToU8(`${JSON.stringify(manifest, null, 2)}\n`),
  });
}

export interface ParsedRt95SafetyZip {
  manifest: Rt95SafetyManifest;
  region: Rt95SafetyRegion;
  bytes: Uint8Array;
  baseName: string;
  /** `''` when the file predates the `serial` key; the caller asks the operator. */
  serial: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function bad(message: string): never {
  throw new RadioProtocolError(message);
}

/** Unzip and verify a safety backup. Throws {@link RadioProtocolError} with an operator-facing message. */
export async function parseRt95SafetyZip(zipBytes: Uint8Array): Promise<ParsedRt95SafetyZip> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zipBytes);
  } catch {
    return bad('This file is not a readable zip.');
  }
  const names = Object.keys(entries);
  const jsonName = names.find((n) => n.endsWith('.json'));
  if (!jsonName) return bad('The zip has no manifest (.json).');
  const baseName = jsonName.slice(0, -'.json'.length);
  const bin = entries[`${baseName}.bin`];
  if (!bin) return bad(`The zip has no ${baseName}.bin beside its manifest.`);
  let json: unknown;
  try {
    json = JSON.parse(strFromU8(entries[jsonName]!));
  } catch {
    return bad('The manifest is not valid JSON.');
  }
  if (!isRecord(json)) return bad('The manifest is not an object.');
  const region = (Object.keys(RT95_SAFETY_FORMAT) as Rt95SafetyRegion[]).find(
    (r) => RT95_SAFETY_FORMAT[r] === json.format,
  );
  if (!region) return bad('This is not an RT95 EEPROM backup (unknown format).');
  for (const key of RT95_SAFETY_MANIFEST_KEYS) {
    if (key === 'serial') continue; // older firmware-tool backups have none
    if (!(key in json)) return bad(`The manifest is missing "${key}".`);
  }
  const { start, end } = rt95SafetyRegionRange(region);
  if (json.version !== 1) return bad('The manifest version must be 1.');
  if (json.start !== start || json.end !== end || json.size !== end - start + 1) {
    return bad('The manifest range does not match its format.');
  }
  if (bin.length !== json.size) {
    return bad(`The data is ${bin.length} bytes; the manifest says ${String(json.size)}.`);
  }
  const sha256 = await sha256Hex(bin);
  if (json.sha256 !== sha256) return bad('The data does not match its SHA-256. Do not use it.');
  if (json.fingerprint !== sha256.slice(0, 8)) return bad('The fingerprint does not match.');
  if (!rt95SafetySignatureOk(bin, start)) {
    return bad('The calibration signature AT778-UV is missing from the data.');
  }
  const ident = json.ident;
  if (!isRecord(ident) || ident.model !== RT95_ALLOWED_MODEL) {
    return bad(`The backup is not from an ${RT95_ALLOWED_MODEL} radio.`);
  }
  if (typeof ident.version !== 'string' || typeof ident.bandlimit !== 'number') {
    return bad('The manifest ident is incomplete.');
  }
  if (typeof json.passes !== 'number' || json.passes < 2) {
    return bad('The backup was not read twice, so it is not trusted.');
  }
  if (!Array.isArray(json.rereads)) return bad('The manifest "rereads" must be a list.');
  const serial = typeof json.serial === 'string' ? normaliseRadioSerial(json.serial) : '';
  const manifest: Rt95SafetyManifest = {
    format: RT95_SAFETY_FORMAT[region],
    version: 1,
    start,
    end,
    size: bin.length,
    sha256,
    fingerprint: sha256.slice(0, 8),
    ident: { model: ident.model, bandlimit: ident.bandlimit, version: ident.version },
    chip: '32KiB',
    signature_ok: true,
    passes: json.passes,
    rereads: json.rereads.filter((n): n is number => typeof n === 'number'),
    created: typeof json.created === 'string' ? json.created : '',
    tool: typeof json.tool === 'string' ? json.tool : '',
    tool_sha256: typeof json.tool_sha256 === 'string' ? json.tool_sha256 : '',
    serial,
  };
  return { manifest, region, bytes: bin, baseName, serial };
}
