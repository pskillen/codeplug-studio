/**
 * The bytes a cable write may send: the same image as `codeplug.bin`, plus the
 * mask of addresses that serialiser stored. The DMR ID database is added only
 * when the write source includes the directory. Private contacts stay in the
 * contact table the serialiser already fills; leaving them out clears their
 * ownership so those slots stay as the radio had them. Unused slots stay
 * owned and empty.
 */

import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import {
  ALL_CALL_DMR_ID,
  CHANNEL_RECORD_SIZE,
  CHANNELS_PER_BANK,
  CONTACT_BASE,
  CONTACT_RECORD_SIZE,
  RX_LIST_LENGTH,
  channelSlotAddress,
} from '@core/import-export/formats/radiofoundry/layout.ts';
import {
  SETTINGS_AREA_KEPT_NOTE,
  serialiseRadioFoundryCodeplug,
} from '@core/import-export/formats/radiofoundry/serialise.ts';
import { RADIOFOUNDRY_LIMITS } from '@core/radios/radiofoundry/limits.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import type { RadioDigitalContactDto } from '../../radioWriteProjection.ts';
import { DM32UV_RADIOFOUNDRY_CABLE_BOARD, type RadioFoundryCableBoard } from './board.ts';
import { BLOCK_SIZE } from './constants.ts';
import {
  DMR_ID_DATABASE_ADDRESS,
  DMR_ID_DATABASE_AREA2_ADDRESS,
  encodeDmrIdDatabase,
  type DmrIdDatabaseRow,
} from './idDatabase.ts';

/** Open-firmware contact record: byte 0x14 is the call type. 1 is private. */
const CONTACT_CALL_TYPE_OFFSET = 0x14;
const PRIVATE_CALL_TYPE = 1;

/**
 * What a cable write does to the settings area. The sector bytes stay unowned;
 * the protocol merges this into the radio's own sector.
 */
export interface RadioFoundryCableSettingsIntent {
  /** True when this write owns a channel bitmap or channel record (D24). */
  ownsChannelTable: boolean;
  /** Channel number → full tag. Empty when the codeplug has no M17 row. */
  channelTags: ReadonlyMap<number, Uint8Array>;
  /** 10-byte 0x0A06. Absent leaves the radio's record, including bytes past 10. */
  callsignRecord?: Uint8Array;
}

export const RADIOFOUNDRY_CABLE_SETTINGS_MERGE_NOTE =
  'Writing to the radio merges its settings area: channel tags are rewritten from this codeplug, and tones, systems, keys and the M17 callsign already on the radio stay unless this codeplug sets a default M17 callsign.';

export interface RadioFoundryWriteSource {
  bytes: Uint8Array;
  owned: Uint8Array;
  warnings: ExportWarning[];
  /** Present on a source built from a codeplug. Absent on a hand-built mask. */
  settings?: RadioFoundryCableSettingsIntent;
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
   * False releases ownership of those records so the radio's bytes stay.
   * Unused contact slots are still written empty.
   */
  includeLibraryContacts?: boolean;
  /** ID-directory rows. Omitted or empty leaves 0x50000 unowned. */
  directoryRows?: readonly RadioDigitalContactDto[];
  /** Build and library defaults for scan, receive-only, and talker alias. */
  exportOptions?: CpsExportOptions;
  /** The board being written. Default is the DM-32UV. Its image end sets the ID database ceiling. */
  board?: RadioFoundryCableBoard;
}

export function radioFoundryWriteSourceFromAssembled(
  assembled: AssembledBuild,
  options?: RadioFoundryCableWriteOptions,
): RadioFoundryWriteSource {
  const image = serialiseRadioFoundryCodeplug(assembled, options?.exportOptions);
  if (options?.includeLibraryContacts === false) {
    releasePrivateContacts(image.bytes, image.owned);
  }
  const directory = options?.directoryRows ?? [];
  const area2 =
    directory.length > 0
      ? writeIdDatabase(
          image.bytes,
          image.owned,
          directory,
          image.warnings,
          options?.board ?? DM32UV_RADIOFOUNDRY_CABLE_BOARD,
        )
      : undefined;
  const m17 = image.m17Settings;
  return {
    bytes: image.bytes,
    owned: image.owned,
    warnings: cableSettingsWarnings(image.warnings),
    settings: {
      ownsChannelTable: radioFoundryWriteOwnsChannelTable(image.owned),
      channelTags: m17?.channelTags ?? new Map(),
      ...(m17?.callsignRecord ? { callsignRecord: m17.callsignRecord } : {}),
    },
    ...(area2 ? { area2: area2.bytes, area2Owned: area2.owned } : {}),
  };
}

/** True when any channel bitmap or channel record byte is owned. */
export function radioFoundryWriteOwnsChannelTable(owned: Uint8Array): boolean {
  const banks = RADIOFOUNDRY_LIMITS.CHANNEL_MAX / CHANNELS_PER_BANK;
  for (let bank = 0; bank < banks; bank += 1) {
    const slot = channelSlotAddress(bank * CHANNELS_PER_BANK + 1);
    const bitmapEnd = slot.bitmap + 16;
    const recordsEnd = slot.record + CHANNELS_PER_BANK * CHANNEL_RECORD_SIZE;
    if (recordsEnd > owned.length) return false;
    for (let i = slot.bitmap; i < bitmapEnd; i += 1) if (owned[i]) return true;
    for (let i = slot.record; i < recordsEnd; i += 1) if (owned[i]) return true;
  }
  return false;
}

function cableSettingsWarnings(warnings: ExportWarning[]): ExportWarning[] {
  return warnings.map((warning) =>
    warning.kind === 'general' && warning.message === SETTINGS_AREA_KEPT_NOTE
      ? { ...warning, message: RADIOFOUNDRY_CABLE_SETTINGS_MERGE_NOTE }
      : warning,
  );
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
  // A loop, not push(...rows): spreading a 300k-row ID directory as call
  // arguments overflows the JS stack ("Maximum call stack size exceeded").
  if (options.includeDigitalIdDirectory) {
    for (const row of directoryRows) rows.push(row);
  }
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
  board: RadioFoundryCableBoard,
): { bytes: Uint8Array; owned: Uint8Array } | undefined {
  const encoded = encodeDmrIdDatabase(rows.map(directoryRow), warnings, {
    area2Bytes: board.limits.IMAGE_END - DMR_ID_DATABASE_AREA2_ADDRESS,
  });
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
