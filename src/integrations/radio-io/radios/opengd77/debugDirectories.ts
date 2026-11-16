/**
 * Read-only OpenGD77 contact bank, RX group list and User Database projections for the debug
 * Memory viewer (DM-1701 and MD-9600).
 *
 * Pure: it takes the archive, never a library, build or React type. A bank counts only when every
 * byte of it was captured (the image is 0xFF fill elsewhere, which is never evidence of "empty").
 * The User Database is decoded lazily, one 27-byte record at a time, because it can hold about
 * 520,000 entries. Wire facts: docs/reference/radios/opengd77/debug-memory.md and user-database.md.
 */
import { OPENGD77_FAMILY_LIMITS } from '@core/radios/opengd77/limits.ts';
import { OPENGD77_BACKUP_USER_DATABASE_ID } from './backupRestoreRoles.ts';
import {
  OPENGD77_CONTACT_COUNT,
  OPENGD77_CONTACT_SIZE,
  OPENGD77_RX_GROUP_BANK_SIZE,
  OPENGD77_RX_GROUP_COUNT,
  OPENGD77_RX_GROUP_LENGTH_TABLE,
  OPENGD77_RX_GROUP_MEMBERS,
  OPENUV380_OFFSET,
  OPENUV380_USER_DB_ENTRIES0_ABS,
  OPENUV380_USER_DB_ENTRIES0_MAX,
  OPENUV380_USER_DB_ENTRIES1_ABS,
  OPENUV380_USER_DB_ENTRY_SIZE,
  OPENUV380_USER_DB_HEADER_ABS,
  OPENUV380_USER_DB_HEADER_SIZE,
  OPENUV380_VOICE_PROMPTS_ABS,
} from './constants.ts';
import { decodeContactsFromImage } from './contactCodec.ts';
import { openGd77CapturedImage, type OpenGd77MemoryArchive } from './debugMemory.ts';
import { readAbs } from './memory.ts';
import { decodeRxGroupsFromImage } from './rxGroupCodec.ts';
import { decodeUserDatabaseHeader, unpackUserDatabaseText } from './userDatabaseCodec.ts';

export type OpenGd77CallTypeLabel = 'Group' | 'Private' | 'All call' | 'Unknown';

export interface OpenGd77ContactEntry {
  /** One-based bank slot, never renumbered. */
  slot: number;
  name: string;
  digitalId: number;
  /** The raw wire value. A value other than 0, 1 or 2 is labelled Unknown, never coerced. */
  callType: number;
  callTypeLabel: OpenGd77CallTypeLabel;
  /** Raw byte at record offset 0x17 (time-slot override); the product decoder does not read it. */
  timeSlotByte: number;
}

export interface OpenGd77ContactsProjection {
  status: 'captured' | 'not-captured';
  entries: OpenGd77ContactEntry[];
  capacity: number;
}

const CALL_TYPE_LABEL: Record<number, OpenGd77CallTypeLabel> = {
  0: 'Group',
  1: 'Private',
  2: 'All call',
};

const CONTACT_BANK_SIZE = OPENGD77_CONTACT_COUNT * OPENGD77_CONTACT_SIZE;

export function projectOpenGd77Contacts(
  archive: OpenGd77MemoryArchive,
): OpenGd77ContactsProjection {
  const { image, covers } = openGd77CapturedImage(archive);
  if (!covers(OPENUV380_OFFSET.contacts, CONTACT_BANK_SIZE))
    return { status: 'not-captured', entries: [], capacity: OPENGD77_CONTACT_COUNT };
  const bank = readAbs(image, OPENUV380_OFFSET.contacts, CONTACT_BANK_SIZE);
  const entries = decodeContactsFromImage(image).map((c) => ({
    slot: c.index,
    name: c.wireName,
    digitalId: c.digitalId,
    callType: c.callType,
    callTypeLabel: CALL_TYPE_LABEL[c.callType] ?? ('Unknown' as const),
    timeSlotByte: bank[(c.index - 1) * OPENGD77_CONTACT_SIZE + 0x17]!,
  }));
  return { status: 'captured', entries, capacity: OPENGD77_CONTACT_COUNT };
}

export interface OpenGd77RxGroupEntry {
  /** One-based list slot. */
  slot: number;
  name: string;
  /** Members the length table declares (capped at the 32 the record holds). */
  declaredMembers: number;
  resolvedMembers: { contactSlot: number; digitalId: number }[];
  /** `declaredMembers - resolved`: members the product decoder cannot resolve, never hidden. */
  unresolved: number;
  /** False when the contact bank was not captured, so every member is unresolved for that reason. */
  contactsCaptured: boolean;
}

export interface OpenGd77RxGroupsProjection {
  status: 'captured' | 'not-captured';
  entries: OpenGd77RxGroupEntry[];
  capacity: number;
}

export function projectOpenGd77RxGroups(
  archive: OpenGd77MemoryArchive,
): OpenGd77RxGroupsProjection {
  const { image, covers } = openGd77CapturedImage(archive);
  if (!covers(OPENUV380_OFFSET.groupLists, OPENGD77_RX_GROUP_BANK_SIZE))
    return { status: 'not-captured', entries: [], capacity: OPENGD77_RX_GROUP_COUNT };
  const contactsCaptured = covers(OPENUV380_OFFSET.contacts, CONTACT_BANK_SIZE);
  const digitalIdBySlot = new Map<number, number>();
  if (contactsCaptured)
    for (const c of decodeContactsFromImage(image)) digitalIdBySlot.set(c.index, c.digitalId);
  // Map each slot to itself so the product decoder hands back contact slots, not DMR IDs.
  const slotMap = new Map([...digitalIdBySlot.keys()].map((slot) => [slot, slot]));
  const bank = readAbs(image, OPENUV380_OFFSET.groupLists, OPENGD77_RX_GROUP_BANK_SIZE);
  const entries = decodeRxGroupsFromImage(image, slotMap).map((g) => {
    const lengthWire = bank[OPENGD77_RX_GROUP_LENGTH_TABLE + g.index - 1]!;
    const declaredMembers = Math.min(Math.max(0, lengthWire - 1), OPENGD77_RX_GROUP_MEMBERS);
    const resolvedMembers = g.memberDigitalIds.map((contactSlot) => ({
      contactSlot,
      digitalId: digitalIdBySlot.get(contactSlot)!,
    }));
    return {
      slot: g.index,
      name: g.wireName,
      declaredMembers,
      resolvedMembers,
      unresolved: Math.max(0, declaredMembers - resolvedMembers.length),
      contactsCaptured,
    };
  });
  return { status: 'captured', entries, capacity: OPENGD77_RX_GROUP_COUNT };
}

export interface OpenGd77UserDatabaseEntry {
  digitalId: number;
  text: string;
  /** The real flash address of the record (the Hex tab shows packed offsets). */
  flashAddress: number;
  /** Offset of the record in the stored region bytes. */
  packedOffset: number;
}

export interface OpenGd77UserDatabaseOk {
  status: 'ok';
  headerEntryCount: number;
  capturedEntries: number;
  /** True when fewer entries are readable than the header declares. */
  truncated: boolean;
  /** True when the header count exceeds the product's `USER_DATABASE_MAX`. */
  beyondProductMax: boolean;
  modeByte: number;
  headerHex: string;
  packedByteLength: number;
  segment0Entries: number;
  segment1Entries: number;
  /** Flash address of segment 1 as the mode byte reads (`'n'` moves it under the prompts). */
  segment1Abs: number;
  /** The 24-bit DMR ID of one entry; reads 3 bytes, decodes no text. */
  idAt(index: number): number;
  /** Decodes one 27-byte record. */
  entryAt(index: number): OpenGd77UserDatabaseEntry;
}

export type OpenGd77UserDatabaseProjection =
  | { status: 'not-captured' }
  | { status: 'refused'; reason: string }
  | { status: 'invalid-header'; reason: string; headerHex: string }
  | OpenGd77UserDatabaseOk;

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');

const readId = (record: Uint8Array, at: number) =>
  (record[at]! | (record[at + 1]! << 8) | (record[at + 2]! << 16)) >>> 0;

/** Header byte 2 `'n'` (lower case): segment 1 sits under the voice prompts. */
const MODE_BYTE_LOWER_N = 0x6e;

export function projectOpenGd77UserDatabase(
  archive: OpenGd77MemoryArchive,
): OpenGd77UserDatabaseProjection {
  const regions = archive.manifest.regions.filter((r) => r.id === OPENGD77_BACKUP_USER_DATABASE_ID);
  if (regions.length === 0) return { status: 'not-captured' };
  const region = regions[0]!;
  const refuse = (reason: string) => ({ status: 'refused' as const, reason });
  if (regions.length > 1) return refuse('duplicate entry for the User Database');
  if (region.address !== OPENUV380_USER_DB_HEADER_ABS)
    return refuse('address does not match the User Database header address');
  if (region.restoreRole !== 'inspect-only') return refuse('role is not inspect-only');
  if (region.path !== `regions/${OPENGD77_BACKUP_USER_DATABASE_ID}.bin`)
    return refuse('unexpected path');
  const bytes = archive.regions[OPENGD77_BACKUP_USER_DATABASE_ID];
  if (!bytes || bytes.length !== region.byteLength)
    return refuse('stored bytes do not match the declared length');
  if (region.byteLength < OPENUV380_USER_DB_HEADER_SIZE)
    return refuse(`length ${region.byteLength} is shorter than the 12-byte header`);

  const header = bytes.subarray(0, OPENUV380_USER_DB_HEADER_SIZE);
  const headerHex = hex(header);
  let decoded: { entryCount: number; entrySize: number };
  try {
    decoded = decodeUserDatabaseHeader(header);
  } catch (e) {
    return {
      status: 'invalid-header',
      reason: e instanceof Error ? e.message : 'header could not be decoded',
      headerHex,
    };
  }
  if (decoded.entrySize !== OPENUV380_USER_DB_ENTRY_SIZE)
    return {
      status: 'invalid-header',
      reason: `entry size ${decoded.entrySize} is not the OpenUV380 entry size ${OPENUV380_USER_DB_ENTRY_SIZE}`,
      headerHex,
    };

  const headerEntryCount = decoded.entryCount;
  const capturedEntries = Math.min(
    headerEntryCount,
    OPENGD77_FAMILY_LIMITS.USER_DATABASE_MAX,
    Math.floor((bytes.length - OPENUV380_USER_DB_HEADER_SIZE) / OPENUV380_USER_DB_ENTRY_SIZE),
  );
  const segment0Entries = Math.min(capturedEntries, OPENUV380_USER_DB_ENTRIES0_MAX);
  const segment1Abs =
    header[2] === MODE_BYTE_LOWER_N ? OPENUV380_VOICE_PROMPTS_ABS : OPENUV380_USER_DB_ENTRIES1_ABS;
  const offsetOf = (index: number) => {
    if (!Number.isInteger(index) || index < 0 || index >= capturedEntries)
      throw new RangeError(`User Database entry ${index} is not captured`);
    return OPENUV380_USER_DB_HEADER_SIZE + index * OPENUV380_USER_DB_ENTRY_SIZE;
  };
  return {
    status: 'ok',
    headerEntryCount,
    capturedEntries,
    truncated: capturedEntries < headerEntryCount,
    beyondProductMax: headerEntryCount > OPENGD77_FAMILY_LIMITS.USER_DATABASE_MAX,
    modeByte: header[2]!,
    headerHex,
    packedByteLength: bytes.length,
    segment0Entries,
    segment1Entries: capturedEntries - segment0Entries,
    segment1Abs,
    idAt: (index) => readId(bytes, offsetOf(index)),
    entryAt(index) {
      const packedOffset = offsetOf(index);
      const record = bytes.subarray(packedOffset, packedOffset + OPENUV380_USER_DB_ENTRY_SIZE);
      return {
        digitalId: readId(record, 0),
        text: unpackUserDatabaseText(record.subarray(3)),
        flashAddress:
          index < OPENUV380_USER_DB_ENTRIES0_MAX
            ? OPENUV380_USER_DB_ENTRIES0_ABS + index * OPENUV380_USER_DB_ENTRY_SIZE
            : segment1Abs + (index - OPENUV380_USER_DB_ENTRIES0_MAX) * OPENUV380_USER_DB_ENTRY_SIZE,
        packedOffset,
      };
    },
  };
}

export interface OpenGd77UserDatabaseQuery {
  kind: 'id-prefix' | 'text';
  value: string;
}

/**
 * Indices of matching entries, ascending, at most `limit`. ID-prefix scans the 3-byte IDs without
 * decoding any text; text decodes one record at a time and stops at `limit`. Nothing is retained.
 */
export function findOpenGd77UserDatabaseEntries(
  projection: OpenGd77UserDatabaseOk,
  query: OpenGd77UserDatabaseQuery,
  limit: number,
): { indices: number[]; capped: boolean } {
  const value = query.value.trim();
  const indices: number[] = [];
  if (!value || limit <= 0) return { indices, capped: false };
  const wantedId = value.replace(/^0+(?=\d)/, '');
  const wantedText = value.toLocaleLowerCase();
  for (let i = 0; i < projection.capturedEntries; i++) {
    const match =
      query.kind === 'id-prefix'
        ? String(projection.idAt(i)).startsWith(wantedId)
        : projection.entryAt(i).text.toLocaleLowerCase().includes(wantedText);
    if (!match) continue;
    if (indices.length >= limit) return { indices, capped: true };
    indices.push(i);
  }
  return { indices, capped: false };
}
