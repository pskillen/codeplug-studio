import { SETTINGS_AREA_ADDRESS, SETTINGS_AREA_SIZE } from './layout.ts';

/** Reader for the RadioFoundry settings area (RFKV sector). Secrets and keys are never decoded here. */

export type SettingsAreaState = 'valid' | 'empty' | 'bad' | 'newer';

export interface SettingsAreaEntry {
  key: number;
  /** A view into the sector, never copied out. */
  value: Uint8Array;
}

export interface SettingsArea {
  state: SettingsAreaState;
  /** Header version byte when the magic matched, else null. */
  version: number | null;
  /** Entries in stored order, duplicates included. Empty unless state is 'valid'. */
  entries: readonly SettingsAreaEntry[];
}

const MAGIC = [0x52, 0x46, 0x4b, 0x56];
const MIN_HEADER = 16;

let crcTable: Uint32Array | null = null;

/**
 * zlib CRC-32 (reflected poly 0xEDB88320). Core cannot import
 * the radio-io kit checksums, so the reader carries its own.
 */
export function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of data) crc = crcTable[(crc ^ b) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Reads the 4096-byte sector. Throws only on a wrong-length argument. */
export function readRadioFoundrySettingsArea(sector: Uint8Array): SettingsArea {
  if (sector.length !== SETTINGS_AREA_SIZE) {
    throw new Error(`Settings area sector must be ${SETTINGS_AREA_SIZE} bytes.`);
  }
  if (sector.every((b) => b === 0xff)) return { state: 'empty', version: null, entries: [] };
  if (!MAGIC.every((m, i) => sector[i] === m)) return { state: 'bad', version: null, entries: [] };
  const version = sector[4]!;
  if (version > 1) return { state: 'newer', version, entries: [] };
  const bad: SettingsArea = { state: 'bad', version, entries: [] };
  if (version !== 1) return bad;

  const headerLength = sector[5]!;
  const dataLength = sector[6]! | (sector[7]! << 8);
  if (headerLength < MIN_HEADER || headerLength + dataLength > SETTINGS_AREA_SIZE) return bad;
  const data = sector.subarray(headerLength, headerLength + dataLength);
  const storedCrc =
    (sector[8]! | (sector[9]! << 8) | (sector[10]! << 16) | (sector[11]! << 24)) >>> 0;
  if (crc32(data) !== storedCrc) return bad;

  const entries: SettingsAreaEntry[] = [];
  let pos = 0;
  while (pos < data.length) {
    if (pos + 4 > data.length) return bad;
    const key = data[pos]! | (data[pos + 1]! << 8);
    const length = data[pos + 2]! | (data[pos + 3]! << 8);
    if (pos + 4 + length > data.length) return bad;
    entries.push({ key, value: data.subarray(pos + 4, pos + 4 + length) });
    pos += 4 + length;
  }
  return { state: 'valid', version, entries };
}

/** The sector inside a codeplug image (image.length must reach SETTINGS_AREA_ADDRESS + SIZE). */
export function settingsAreaSector(image: Uint8Array): Uint8Array {
  if (image.length < SETTINGS_AREA_ADDRESS + SETTINGS_AREA_SIZE) {
    throw new Error('Image is too short to hold the settings area.');
  }
  return image.subarray(SETTINGS_AREA_ADDRESS, SETTINGS_AREA_ADDRESS + SETTINGS_AREA_SIZE);
}

/** First entry for a key, or null (one entry per key: a reader takes the first). */
export function firstSettingsEntry(area: SettingsArea, key: number): SettingsAreaEntry | null {
  return area.entries.find((e) => e.key === key) ?? null;
}
