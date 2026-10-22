/**
 * Release patch dispatcher: bytes → UTF-8 → JSON → the format module named by `name` + `format`.
 * Generic: knows nothing of file layouts. Each format module lives under `formats/<patch-name>/`.
 */
import { FirmwareError } from '../errors.ts';
import type { FirmwarePackage } from '../types.ts';
import { anytoneD890PatchFormat } from './formats/anytone-d890-firmware/index.ts';
import { baofengDm32PatchFormat } from './formats/baofeng-dm32-firmware/index.ts';
import { isRecord } from './schema.ts';
import type { FirmwarePatchFormat, ParsedFirmwarePatch } from './types.ts';

export type {
  FirmwarePatchDescription,
  FirmwarePatchFormat,
  FirmwarePatchHashes,
  ParsedFirmwarePatch,
} from './types.ts';

const FORMATS: readonly FirmwarePatchFormat<unknown>[] = [
  baofengDm32PatchFormat,
  anytoneD890PatchFormat,
];

export function listFirmwarePatchFormats(): readonly FirmwarePatchFormat<unknown>[] {
  return FORMATS;
}

/** bytes → UTF-8 (fatal) → JSON → dispatch on `name` + `format`. */
export function parseFirmwarePatch(bytes: Uint8Array): ParsedFirmwarePatch {
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new FirmwareError('patch-unreadable', 'This file is not a readable firmware patch.');
  }
  if (!isRecord(json)) {
    throw new FirmwareError('patch-unknown-format', 'This file is not a firmware patch.');
  }
  const { name, format: version } = json;
  const format = FORMATS.find((f) => f.name === name);
  if (!format) {
    throw new FirmwareError(
      'patch-unknown-format',
      typeof name === 'string'
        ? `Firmware patches named "${name}" are not supported.`
        : 'This file is not a firmware patch.',
    );
  }
  if (typeof version !== 'number' || !format.formats.includes(version)) {
    throw new FirmwareError(
      'patch-unknown-format',
      `This "${format.name}" patch uses format ${String(version)}, which this version of Studio does not support.`,
    );
  }
  const patch = format.parse(json);
  return { format, patch, description: format.describe(patch) };
}

export function applyFirmwarePatch(
  stock: FirmwarePackage,
  parsed: ParsedFirmwarePatch,
): Promise<FirmwarePackage> {
  return parsed.format.apply(stock, parsed.patch);
}

export function readFirmwarePatchVersionStamp(
  result: FirmwarePackage,
  parsed: ParsedFirmwarePatch,
): string | undefined {
  return parsed.format.readVersionStamp?.(result, parsed.patch);
}
