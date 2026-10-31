/**
 * The bytes a cable write may send: the same image as `codeplug.bin`, plus the
 * mask of addresses that serialiser stored. The DMR ID database is added only
 * when the write source includes the directory. Private contacts stay in the
 * contact table the serialiser already fills; leaving them out clears their
 * ownership and does not blank the table.
 */

import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import {
  ALL_CALL_DMR_ID,
  CONTACT_BASE,
  CONTACT_RECORD_SIZE,
  RX_LIST_LENGTH,
} from '@core/import-export/formats/radiofoundry/layout.ts';
import { serialiseRadioFoundryCodeplug } from '@core/import-export/formats/radiofoundry/serialise.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import type { RadioDigitalContactDto } from '../../radioWriteProjection.ts';
import { BLOCK_SIZE } from './constants.ts';
import {
  DMR_ID_DATABASE_ADDRESS,
  encodeDmrIdDatabase,
  type DmrIdDatabaseRow,
} from './idDatabase.ts';

/** Open-firmware contact record: byte 0x14 is the call type. 1 is private. */
const CONTACT_CALL_TYPE_OFFSET = 0x14;
const PRIVATE_CALL_TYPE = 1;

export interface Dm32RadioFoundryWriteSource {
  bytes: Uint8Array;
  owned: Uint8Array;
  warnings: ExportWarning[];
  /**
   * Records past area 1, placed at image `0xD8000`. Absent when the directory
   * fits in area 1 or is not part of this write. The gap before `0xD8000` is
   * not owned.
   */
  area2?: Uint8Array;
  area2Owned?: Uint8Array;
}

export interface RadioFoundryCableWriteOptions {
  /**
   * Private contacts from the assembled build. Default keeps them.
   * False releases their ownership so the radio's contact slots stay.
   */
  includeLibraryContacts?: boolean;
  /** ID-directory rows. Omitted or empty leaves 0x50000 unowned. */
  directoryRows?: readonly RadioDigitalContactDto[];
  /** Build and library defaults for scan, receive-only, and talker alias. */
  exportOptions?: CpsExportOptions;
}

export function radioFoundryWriteSourceFromAssembled(
  assembled: AssembledBuild,
  options?: RadioFoundryCableWriteOptions,
): Dm32RadioFoundryWriteSource {
  const image = serialiseRadioFoundryCodeplug(assembled, options?.exportOptions);
  if (options?.includeLibraryContacts === false) {
    releasePrivateContacts(image.bytes, image.owned);
  }
  const directory = options?.directoryRows ?? [];
  const area2 =
    directory.length > 0
      ? writeIdDatabase(image.bytes, image.owned, directory, image.warnings)
      : undefined;
  return {
    bytes: image.bytes,
    owned: image.owned,
    warnings: image.warnings,
    ...(area2 ? { area2: area2.bytes, area2Owned: area2.owned } : {}),
  };
}

/**
 * Rows the review line counts. Undefined when the contacts part is off, so a
 * codeplug-only write does not claim a contact write. An empty array means the
 * chosen source produced no rows.
 */
export function radioFoundryReviewContacts(
  assembled: AssembledBuild,
  directoryRows: readonly RadioDigitalContactDto[],
  options: { includeLibraryContacts: boolean; includeDigitalIdDirectory: boolean },
): RadioDigitalContactDto[] | undefined {
  if (!options.includeLibraryContacts && !options.includeDigitalIdDirectory) return undefined;
  const rows: RadioDigitalContactDto[] = [];
  if (options.includeLibraryContacts) {
    for (const row of assembled.digitalContacts) {
      const id = row.entity.digitalId;
      if (row.entity.mode !== 'dmr' || !Number.isInteger(id) || id < 0 || id > ALL_CALL_DMR_ID) {
        continue;
      }
      rows.push({
        wireName: row.wireName,
        digitalId: id,
        callsign: row.entity.callsign,
        city: row.entity.city,
        province: row.entity.state,
        country: row.entity.country,
        remark: row.entity.remarks,
      });
    }
  }
  if (options.includeDigitalIdDirectory) rows.push(...directoryRows);
  return rows;
}

/** Block addresses that contain an owned private-contact record. */
export function ownedPrivateContactBlocks(source: {
  bytes: Uint8Array;
  owned: Uint8Array;
}): number[] {
  const addrs: number[] = [];
  const end = Math.min(source.bytes.length, RX_LIST_LENGTH);
  for (
    let offset = CONTACT_BASE;
    offset + CONTACT_RECORD_SIZE <= end;
    offset += CONTACT_RECORD_SIZE
  ) {
    if (!source.owned[offset]) continue;
    if (source.bytes[offset + CONTACT_CALL_TYPE_OFFSET] !== PRIVATE_CALL_TYPE) continue;
    const start = offset - (offset % BLOCK_SIZE);
    if (!addrs.includes(start)) addrs.push(start);
    const last = offset + CONTACT_RECORD_SIZE - 1;
    const endBlock = last - (last % BLOCK_SIZE);
    if (!addrs.includes(endBlock)) addrs.push(endBlock);
  }
  return addrs;
}

function releasePrivateContacts(bytes: Uint8Array, owned: Uint8Array): void {
  const end = Math.min(bytes.length, RX_LIST_LENGTH);
  for (
    let offset = CONTACT_BASE;
    offset + CONTACT_RECORD_SIZE <= end;
    offset += CONTACT_RECORD_SIZE
  ) {
    if (bytes[offset + CONTACT_CALL_TYPE_OFFSET] !== PRIVATE_CALL_TYPE) continue;
    owned.fill(0, offset, offset + CONTACT_RECORD_SIZE);
  }
}

function writeIdDatabase(
  bytes: Uint8Array,
  owned: Uint8Array,
  rows: readonly RadioDigitalContactDto[],
  warnings: ExportWarning[],
): { bytes: Uint8Array; owned: Uint8Array } | undefined {
  const encoded = encodeDmrIdDatabase(rows.map(directoryRow), warnings);
  if (!encoded) return undefined;
  bytes.set(encoded.area1, DMR_ID_DATABASE_ADDRESS);
  owned.fill(1, DMR_ID_DATABASE_ADDRESS, DMR_ID_DATABASE_ADDRESS + encoded.area1.length);
  if (encoded.area2.length === 0) return undefined;
  const area2Owned = new Uint8Array(encoded.area2.length);
  area2Owned.fill(1);
  return { bytes: encoded.area2, owned: area2Owned };
}

function directoryRow(row: RadioDigitalContactDto): DmrIdDatabaseRow {
  const callsign = row.callsign.trim();
  const wire = row.wireName.trim();
  return { digitalId: row.digitalId, callsign, name: wire === callsign ? '' : wire };
}
