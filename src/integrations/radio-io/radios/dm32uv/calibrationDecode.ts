/**
 * DM-32UV calibration page and factory-sector decode (firmware 048).
 * Pure: no React. There is no checksum on the calibration page.
 * SHA-256 uses `crypto.subtle` so the browser bundle does not import `node:crypto`.
 */

import { RadioBackupError, type RadioBackupRegionV1 } from '../../backup/types.ts';
import {
  DM32_BLOCK_SIZE,
  DM32_FACTORY_SECTOR_ADDRESS,
  DM32_FACTORY_SECTOR_LENGTH,
  DM32_METADATA_OFFSET,
} from './constants.ts';
import { selectDm32CalibrationPages, type Dm32ConfigWindow } from './memory.ts';

export const DM32_CALIBRATION_JSON_PATH = 'calibration.json';
export const DM32_FACTORY_JSON_PATH = 'factory-sector.json';
export const DM32_FACTORY_SECTOR_REGION_ID = 'factory-sector';

export interface Dm32HexRow {
  offset: number;
  length: number;
  hex: string;
}

export interface Dm32BandLimits {
  /** Hz from u16 LE BCD in 100 kHz units. Null when a nibble is not BCD. */
  lowHz: number | null;
  highHz: number | null;
}

export interface Dm32CalibrationPageDecode {
  address: number;
  tag: number;
  uhfBand: Dm32BandLimits;
  vhfBand: Dm32BandLimits;
  /** Five u32 LE BCD points, 10 Hz units, in Hz. */
  frequencyPointsHz: {
    uhfRx: (number | null)[];
    uhfTx: (number | null)[];
    vhfRx: (number | null)[];
    vhfTx: (number | null)[];
  };
  uhfPower: { low: number[]; mid: number[]; high: number[] };
  vhfPower: { low: number[]; mid: number[]; high: number[] };
  /**
   * Level-1 / level-9 pairs (5 bytes each). UHF and VHF each have two pairs.
   * Levels 2–8 are interpolated on the radio. Meaning is inferred as squelch.
   */
  levels: {
    uhf: { level1: number[]; level9: number[] }[];
    vhf: { level1: number[]; level9: number[] }[];
    airband: { level1: number[]; level9: number[] };
  };
  /** u16 LE masked with 0xFFF. Valid when the raw value is 1–1000. */
  maskedAdjust: {
    at0x00c: number;
    at0x00e: number;
    at0x00cValid: boolean;
    at0x00eValid: boolean;
  };
  bootScalars: Dm32HexRow[];
  unknownRows: Dm32HexRow[];
}

export interface Dm32FactorySectorDecode {
  address: number;
  gpsEnabled: boolean;
  txRegion: number;
  /** `4` or `0xA5` means 136–174 / 400–470 MHz. `0`–`3` are restricted windows. */
  txRegionUnrestricted: boolean;
  optionBytes: { offset: number; value: number }[];
  antiCloneKeyHex: string;
}

export interface Dm32CalibrationBackupJson {
  liveAddress: number | null;
  tag: number | null;
  duplicateAddresses: number[];
  sha256: string | null;
  decoded: Dm32CalibrationPageDecode | null;
  unknownRows: Dm32HexRow[];
  /** First 8 bytes of V-frame `0x02`. Not a radio serial. */
  efuseUidHex: string | null;
  /** Remaining V-frame `0x02` bytes after the UID, when present. */
  efuseDerivedHex: string | null;
}

export interface Dm32FactoryBackupJson {
  kept: boolean;
  reason?: 'mismatch' | 'failed';
  address?: number;
  sha256?: string;
  decoded?: Dm32FactorySectorDecode;
}

const UNKNOWN_ROWS: readonly { offset: number; length: number }[] = [
  { offset: 0x017, length: 5 },
  { offset: 0x01c, length: 3 },
  { offset: 0x030, length: 12 },
  { offset: 0x0a6, length: 5 },
  { offset: 0x0ab, length: 3 },
  { offset: 0x0c0, length: 12 },
  { offset: 0x150, length: 12 },
  { offset: 0x188, length: 12 },
  { offset: 0x210, length: 6 },
];

const BOOT_SCALARS: readonly { offset: number; length: number }[] = [
  { offset: 0x016, length: 1 },
  { offset: 0x027, length: 1 },
  { offset: 0x201, length: 9 },
];

const FACTORY_OPTION_OFFSETS = [0x80, 0x81, 0x82, 0xa0, 0xa2] as const;

function hexBytes(data: Uint8Array): string {
  return [...data].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function row(data: Uint8Array, offset: number, length: number): Dm32HexRow {
  return { offset, length, hex: hexBytes(data.subarray(offset, offset + length)) };
}

function bcdValue(nibbles: readonly number[]): number | null {
  if (nibbles.some((nibble) => nibble > 9)) return null;
  let value = 0;
  for (const nibble of nibbles) value = value * 10 + nibble;
  return value;
}

/** u16 LE BCD. High byte holds the higher digits. */
function bcdU16(data: Uint8Array, offset: number): number | null {
  const lo = data[offset] ?? 0;
  const hi = data[offset + 1] ?? 0;
  return bcdValue([hi >> 4, hi & 0x0f, lo >> 4, lo & 0x0f]);
}

/** u32 LE BCD. */
function bcdU32(data: Uint8Array, offset: number): number | null {
  const bytes = [3, 2, 1, 0].map((shift) => data[offset + shift] ?? 0);
  const nibbles = bytes.flatMap((byte) => [byte >> 4, byte & 0x0f]);
  return bcdValue(nibbles);
}

function bandLimits(data: Uint8Array, offset: number): Dm32BandLimits {
  const low = bcdU16(data, offset);
  const high = bcdU16(data, offset + 2);
  return {
    lowHz: low === null ? null : low * 100_000,
    highHz: high === null ? null : high * 100_000,
  };
}

function frequencyPoints(data: Uint8Array, offset: number): (number | null)[] {
  const points: (number | null)[] = [];
  for (let i = 0; i < 5; i++) {
    const digits = bcdU32(data, offset + i * 4);
    points.push(digits === null ? null : digits * 10);
  }
  return points;
}

function fiveBytes(data: Uint8Array, offset: number): number[] {
  return [...data.subarray(offset, offset + 5)];
}

function maskedU16(data: Uint8Array, offset: number): number {
  const lo = data[offset] ?? 0;
  const hi = data[offset + 1] ?? 0;
  return (lo | (hi << 8)) & 0xfff;
}

export function decodeDm32CalibrationPage(
  data: Uint8Array,
  address: number,
): Dm32CalibrationPageDecode {
  if (data.byteLength !== DM32_BLOCK_SIZE) {
    throw new RadioBackupError(
      `DM-32 calibration page is ${data.byteLength} bytes, expected ${DM32_BLOCK_SIZE}`,
    );
  }
  const at0x00c = maskedU16(data, 0x00c);
  const at0x00e = maskedU16(data, 0x00e);
  return {
    address,
    tag: data[DM32_METADATA_OFFSET] ?? 0,
    uhfBand: bandLimits(data, 0x000),
    vhfBand: bandLimits(data, 0x0cc),
    frequencyPointsHz: {
      uhfRx: frequencyPoints(data, 0x300),
      uhfTx: frequencyPoints(data, 0x314),
      vhfRx: frequencyPoints(data, 0x328),
      vhfTx: frequencyPoints(data, 0x33c),
    },
    uhfPower: {
      low: fiveBytes(data, 0x040),
      mid: fiveBytes(data, 0x045),
      high: fiveBytes(data, 0x04a),
    },
    vhfPower: {
      low: fiveBytes(data, 0x0d0),
      mid: fiveBytes(data, 0x0d5),
      high: fiveBytes(data, 0x0da),
    },
    levels: {
      uhf: [
        { level1: fiveBytes(data, 0x064), level9: fiveBytes(data, 0x069) },
        { level1: fiveBytes(data, 0x06e), level9: fiveBytes(data, 0x073) },
      ],
      vhf: [
        { level1: fiveBytes(data, 0x0e0), level9: fiveBytes(data, 0x0e5) },
        { level1: fiveBytes(data, 0x0ea), level9: fiveBytes(data, 0x0ef) },
      ],
      airband: { level1: fiveBytes(data, 0x080), level9: fiveBytes(data, 0x085) },
    },
    maskedAdjust: {
      at0x00c,
      at0x00e,
      at0x00cValid: at0x00c >= 1 && at0x00c <= 1000,
      at0x00eValid: at0x00e >= 1 && at0x00e <= 1000,
    },
    bootScalars: BOOT_SCALARS.map((span) => row(data, span.offset, span.length)),
    unknownRows: UNKNOWN_ROWS.map((span) => row(data, span.offset, span.length)),
  };
}

export function decodeDm32FactorySector(data: Uint8Array): Dm32FactorySectorDecode {
  if (data.byteLength !== DM32_FACTORY_SECTOR_LENGTH) {
    throw new RadioBackupError(
      `DM-32 factory sector is ${data.byteLength} bytes, expected ${DM32_FACTORY_SECTOR_LENGTH}`,
    );
  }
  const txRegion = data[0xa1] ?? 0;
  return {
    address: DM32_FACTORY_SECTOR_ADDRESS,
    gpsEnabled: ((data[0x80] ?? 0) & 0x04) !== 0,
    txRegion,
    txRegionUnrestricted: txRegion === 4 || txRegion === 0xa5,
    optionBytes: FACTORY_OPTION_OFFSETS.map((offset) => ({ offset, value: data[offset] ?? 0 })),
    antiCloneKeyHex: hexBytes(data.subarray(0x10c, 0x110)),
  };
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(data));
  return hexBytes(new Uint8Array(digest));
}

function jsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

export function dm32FactorySectorRegion(bytes: Uint8Array): {
  region: RadioBackupRegionV1;
  bytes: Uint8Array;
} {
  if (bytes.byteLength !== DM32_FACTORY_SECTOR_LENGTH) {
    throw new RadioBackupError(
      `DM-32 factory sector is ${bytes.byteLength} bytes, expected ${DM32_FACTORY_SECTOR_LENGTH}`,
    );
  }
  return {
    region: {
      id: DM32_FACTORY_SECTOR_REGION_ID,
      label: 'Factory sector (inspect only)',
      address: DM32_FACTORY_SECTOR_ADDRESS,
      byteLength: bytes.byteLength,
      path: `regions/${DM32_FACTORY_SECTOR_REGION_ID}.bin`,
      restoreRole: 'inspect-only',
    },
    bytes: bytes.slice(),
  };
}

function blockMetadata(data: Uint8Array): number {
  if (data.byteLength >= DM32_BLOCK_SIZE) return data[DM32_METADATA_OFFSET] ?? 0;
  return data[data.byteLength - 1] ?? 0;
}

/**
 * Zip sidecars for Backup. The eFuse UID is identity in the JSON only —
 * callers must not copy it into `manifest.serial`.
 */
export async function buildDm32CalibrationBackupSidecars(input: {
  blocks: readonly { address: number; data: Uint8Array }[];
  window: Dm32ConfigWindow;
  efuse: Uint8Array | null;
  factorySector: Uint8Array | null;
  factoryNotKeptReason: 'mismatch' | 'failed' | null;
}): Promise<Record<string, Uint8Array>> {
  const tagged = input.blocks
    .filter((block) => block.data.byteLength >= DM32_BLOCK_SIZE)
    .map((block) => ({
      address: block.address,
      metadata: blockMetadata(block.data),
      data: block.data,
    }));
  const selection = selectDm32CalibrationPages(tagged, input.window);
  const live = selection.live;
  const decoded = live ? decodeDm32CalibrationPage(live.data, live.address) : null;
  const efuse = input.efuse && input.efuse.byteLength > 0 ? input.efuse : null;
  const calibration: Dm32CalibrationBackupJson = {
    liveAddress: live?.address ?? null,
    tag: live ? blockMetadata(live.data) : null,
    duplicateAddresses: selection.duplicates.map((page) => page.address),
    sha256: live ? await sha256Hex(live.data.subarray(0, DM32_BLOCK_SIZE)) : null,
    decoded,
    unknownRows: decoded?.unknownRows ?? [],
    efuseUidHex: efuse ? hexBytes(efuse.subarray(0, Math.min(8, efuse.byteLength))) : null,
    efuseDerivedHex: efuse && efuse.byteLength > 8 ? hexBytes(efuse.subarray(8)) : null,
  };

  const sidecars: Record<string, Uint8Array> = {
    [DM32_CALIBRATION_JSON_PATH]: jsonBytes(calibration),
  };

  if (input.factorySector) {
    const factory: Dm32FactoryBackupJson = {
      kept: true,
      address: DM32_FACTORY_SECTOR_ADDRESS,
      sha256: await sha256Hex(input.factorySector),
      decoded: decodeDm32FactorySector(input.factorySector),
    };
    sidecars[DM32_FACTORY_JSON_PATH] = jsonBytes(factory);
  } else if (input.factoryNotKeptReason) {
    const factory: Dm32FactoryBackupJson = {
      kept: false,
      reason: input.factoryNotKeptReason,
    };
    sidecars[DM32_FACTORY_JSON_PATH] = jsonBytes(factory);
  }

  return sidecars;
}
