/**
 * Open-firmware DMR ID database (docs/spec/open-firmware-cps.md §7.5).
 * Fast-protocol address 0x50000 is flash-image 0x30000. The radio adds 0x700000.
 * This module never emits that base, format `n`, or the voice-prompt area.
 * Records past area 1 continue at 0xD8000 and stop before the native codeplug.
 */

import { pushGeneralWarning, type ExportWarning } from '@core/import-export/exportWarning.ts';
import { BLOCK_SIZE } from './constants.ts';

/** Image offset of area 1. Not 0x700000. */
export const DMR_ID_DATABASE_ADDRESS = 0x50000;

/** Area 1 length. Records past this continue in area 2. */
export const DMR_ID_DATABASE_AREA1_BYTES = 0x40000;

/**
 * Area 2 image offset. Flash image `0xB8000`, which is physical `0x7D8000`
 * after the radio adds `0x700000`. The voice-prompt region sits before this.
 */
export const DMR_ID_DATABASE_AREA2_ADDRESS = 0xd8000;

/**
 * First address past the open-firmware image (`openfw_end` 0xF00000 minus the
 * EEPROM base). The native codeplug starts here. Area 2 must not reach it.
 */
export const DMR_ID_DATABASE_IMAGE_END = 0x800000;

/** Bytes of area 2 that sit inside the open-firmware image. */
export const DMR_ID_DATABASE_AREA2_BYTES =
  DMR_ID_DATABASE_IMAGE_END - DMR_ID_DATABASE_AREA2_ADDRESS;

export const DMR_ID_DATABASE_HEADER_BYTES = 12;

/** 3-byte ID plus 32 characters packed at 6 bits (24 bytes). */
export const DMR_ID_DATABASE_RECORD_BYTES = 27;

export const DMR_ID_DATABASE_TEXT_CHARS = 32;

/** Record-size header byte: record length + 0x4A. */
export const DMR_ID_DATABASE_SIZE_BYTE = DMR_ID_DATABASE_RECORD_BYTES + 0x4a;

export const DMR_ID_DATABASE_AREA1_RECORDS = Math.floor(
  (DMR_ID_DATABASE_AREA1_BYTES - DMR_ID_DATABASE_HEADER_BYTES) / DMR_ID_DATABASE_RECORD_BYTES,
);

export const DMR_ID_DATABASE_AREA2_RECORDS = Math.floor(
  DMR_ID_DATABASE_AREA2_BYTES / DMR_ID_DATABASE_RECORD_BYTES,
);

/** Area 1 plus the part of area 2 that ends at the native codeplug. */
export const DMR_ID_DATABASE_MAX_RECORDS =
  DMR_ID_DATABASE_AREA1_RECORDS + DMR_ID_DATABASE_AREA2_RECORDS;

/** 4 KB blocks that cover `byteLength` of area 2. Empty when there is no spill. */
export function dmrIdDatabaseArea2Blocks(byteLength: number): number[] {
  if (byteLength <= 0) return [];
  const end = DMR_ID_DATABASE_AREA2_ADDRESS + byteLength;
  if (end > DMR_ID_DATABASE_IMAGE_END) {
    throw new Error('DMR ID database area 2 passes the native codeplug.');
  }
  const addrs: number[] = [];
  for (let addr = DMR_ID_DATABASE_AREA2_ADDRESS; addr < end; addr += BLOCK_SIZE) {
    addrs.push(addr);
  }
  return addrs;
}

export interface EncodedDmrIdDatabase {
  /** Header plus the records that fit in area 1. The count field is the total. */
  area1: Uint8Array;
  /** Records past area 1. Empty when the database fits in area 1. */
  area2: Uint8Array;
}

export interface DmrIdDatabaseLimits {
  area1Bytes?: number;
  area2Bytes?: number;
}

/** Space, 0-9, A-Z, a-z, `.` — codes 0-63. */
const ALPHABET = ' 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.';

const ID_BYTES = 3;
const MAX_DMR_ID = 0xff_ffff;

export interface DmrIdDatabaseRow {
  digitalId: number;
  callsign: string;
  /** Directory name. Empty when the row has only a callsign. */
  name: string;
}

/**
 * Header plus sorted records, or null when there is nothing to own.
 * Area 1 holds as many whole records as fit after the header. The rest go to
 * area 2, up to `area2Bytes`. The header count includes both areas.
 */
export function encodeDmrIdDatabase(
  rows: readonly DmrIdDatabaseRow[],
  warnings: ExportWarning[],
  limits: DmrIdDatabaseLimits = {},
): EncodedDmrIdDatabase | null {
  const area1Bytes = limits.area1Bytes ?? DMR_ID_DATABASE_AREA1_BYTES;
  const area2Bytes = limits.area2Bytes ?? DMR_ID_DATABASE_AREA2_BYTES;
  const area1Records = Math.max(
    0,
    Math.floor((area1Bytes - DMR_ID_DATABASE_HEADER_BYTES) / DMR_ID_DATABASE_RECORD_BYTES),
  );
  const area2Records = Math.max(0, Math.floor(area2Bytes / DMR_ID_DATABASE_RECORD_BYTES));
  const maxRecords = area1Records + area2Records;
  const kept: DmrIdDatabaseRow[] = [];
  let invalid = 0;
  for (const row of rows) {
    if (!Number.isInteger(row.digitalId) || row.digitalId <= 0 || row.digitalId > MAX_DMR_ID) {
      invalid += 1;
      continue;
    }
    kept.push(row);
  }
  if (invalid > 0) {
    pushGeneralWarning(
      warnings,
      `Dropped ${invalid} DMR ID database row(s) whose ID does not fit in 3 bytes.`,
    );
  }
  kept.sort((a, b) => a.digitalId - b.digitalId);
  if (kept.length > maxRecords) {
    const dropped = kept.length - maxRecords;
    pushGeneralWarning(
      warnings,
      `Dropped ${dropped} DMR ID database row(s) that do not fit before the native codeplug (${maxRecords} records).`,
    );
    kept.length = maxRecords;
  }
  if (kept.length === 0 || maxRecords === 0) return null;

  const inArea1 = Math.min(kept.length, area1Records);
  const area1 = new Uint8Array(
    DMR_ID_DATABASE_HEADER_BYTES + inArea1 * DMR_ID_DATABASE_RECORD_BYTES,
  );
  area1[0] = 0x49;
  area1[1] = 0x64;
  area1[2] = 0x4e;
  area1[3] = DMR_ID_DATABASE_SIZE_BYTE;
  area1[4] = 0x30;
  area1[5] = 0x30;
  area1[6] = 0x31;
  area1[7] = 0x00;
  area1[8] = kept.length & 0xff;
  area1[9] = (kept.length >> 8) & 0xff;
  area1[10] = (kept.length >> 16) & 0xff;
  area1[11] = (kept.length >>> 24) & 0xff;
  const area2 = new Uint8Array((kept.length - inArea1) * DMR_ID_DATABASE_RECORD_BYTES);
  kept.forEach((row, index) => {
    const dest = index < inArea1 ? area1 : area2;
    const at =
      index < inArea1
        ? DMR_ID_DATABASE_HEADER_BYTES + index * DMR_ID_DATABASE_RECORD_BYTES
        : (index - inArea1) * DMR_ID_DATABASE_RECORD_BYTES;
    dest[at] = row.digitalId & 0xff;
    dest[at + 1] = (row.digitalId >> 8) & 0xff;
    dest[at + 2] = (row.digitalId >> 16) & 0xff;
    dest.set(packText(idDatabaseText(row.callsign, row.name)), at + ID_BYTES);
  });
  return { area1, area2 };
}

/** `callsign name`, trimmed, limited to the packed alphabet and 32 characters. */
export function idDatabaseText(callsign: string, name: string): string {
  const raw = `${callsign.trim()} ${name.trim()}`.trim();
  let text = '';
  for (const ch of raw) text += ALPHABET.includes(ch) ? ch : ' ';
  return text.trim().slice(0, DMR_ID_DATABASE_TEXT_CHARS);
}

function packText(text: string): Uint8Array {
  const chars = text.padEnd(DMR_ID_DATABASE_TEXT_CHARS, ' ').slice(0, DMR_ID_DATABASE_TEXT_CHARS);
  const packed = new Uint8Array(DMR_ID_DATABASE_RECORD_BYTES - ID_BYTES);
  for (let i = 0; i < DMR_ID_DATABASE_TEXT_CHARS; i += 4) {
    const c0 = ALPHABET.indexOf(chars[i]!);
    const c1 = ALPHABET.indexOf(chars[i + 1]!);
    const c2 = ALPHABET.indexOf(chars[i + 2]!);
    const c3 = ALPHABET.indexOf(chars[i + 3]!);
    const at = (i / 4) * 3;
    packed[at] = ((c0 & 0x3f) << 2) | ((c1 >> 4) & 0x03);
    packed[at + 1] = ((c1 & 0x0f) << 4) | ((c2 >> 2) & 0x0f);
    packed[at + 2] = ((c2 & 0x03) << 6) | (c3 & 0x3f);
  }
  return packed;
}
