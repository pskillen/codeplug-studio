/**
 * Read-only DMR ID database view for RadioFoundry debug archives — header, integrity and lookup over
 * captured bytes only.
 */
import type { RadioBackupManifestV1 } from '../../backup/types.ts';
import {
  DMR_ID_DATABASE_ADDRESS,
  DMR_ID_DATABASE_AREA1_BYTES,
  DMR_ID_DATABASE_AREA1_RECORDS,
  DMR_ID_DATABASE_HEADER_BYTES,
  DMR_ID_DATABASE_RECORD_BYTES,
  DMR_ID_DATABASE_SIZE_BYTE,
} from './idDatabase.ts';
import { FLASH_IMAGE_START } from './constants.ts';
import {
  RADIOFOUNDRY_DEBUG_IDDB_SIDECAR,
  RADIOFOUNDRY_DEBUG_INFO_SIDECAR,
  RADIOFOUNDRY_REGION,
} from './debugCapture.ts';
import { radioFoundryCableBoardForModelId } from './board.ts';

const ALPHABET = ' 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.';
const FORMAT_N_AREA2_VOICE_PROMPT = 0xaf400;

export interface IddbRadioReply {
  format: string | null;
  records: number;
}

export type RadioFoundryIdDatabaseView =
  | { status: 'not-captured' }
  | { status: 'none'; headerHex: string; radio?: IddbRadioReply }
  | { status: 'compact'; headerHex: string; radio?: IddbRadioReply }
  | {
      status: 'voice-prompt-area2';
      headerCount: number;
      area2Address: typeof FORMAT_N_AREA2_VOICE_PROMPT;
      radio?: IddbRadioReply;
    }
  | { status: 'unreadable'; reason: string; radio?: IddbRadioReply }
  | {
      status: 'ok';
      format: 'N';
      headerCount: number;
      radio?: IddbRadioReply;
      area1Records: number;
      area2Records: number | 'not-captured';
      radioReadsIt: boolean;
      integrity: {
        ascending: boolean;
        firstBreak?: { index: number; id: number; previous: number };
        blankRecords: number;
      };
      record(index: number): { id: number; text: string } | undefined;
      lookup(
        id: number,
      ):
        | { found: true; index: number; text: string }
        | { found: false; nearest?: { index: number; id: number } }
        | { notCaptured: true };
    };

export interface RadioFoundryIdDatabaseArchive {
  manifest: RadioBackupManifestV1;
  regions: Record<string, Uint8Array>;
  sidecars: Record<string, Uint8Array>;
}

function readU32(data: Uint8Array, offset: number): number {
  return (
    (data[offset]! |
      (data[offset + 1]! << 8) |
      (data[offset + 2]! << 16) |
      (data[offset + 3]! << 24)) >>>
    0
  );
}

function hexBytes(bytes: Uint8Array, max = 12): string {
  const slice = bytes.subarray(0, Math.min(bytes.length, max));
  return [...slice].map((b) => b.toString(16).padStart(2, '0')).join(' ');
}

function unpackText(packed: Uint8Array): string {
  let text = '';
  const charCount = Math.floor((packed.length * 4) / 3);
  for (let j = 0; j < charCount; j += 1) {
    const bit = 6 * j;
    const byte = Math.floor(bit / 8);
    const w = ((packed[byte] ?? 0) << 8) | (packed[byte + 1] ?? 0);
    const code = (w >> (10 - (bit % 8))) & 0x3f;
    text += ALPHABET[code] ?? '?';
  }
  return text.trimEnd();
}

function readRecordId(record: Uint8Array): number {
  return record[0]! | (record[1]! << 8) | (record[2]! << 16);
}

function isBlankRecord(record: Uint8Array): boolean {
  if (record.length < DMR_ID_DATABASE_RECORD_BYTES) return true;
  const first = record[0]!;
  if (first === 0x00) return record.every((b) => b === 0x00);
  if (first === 0xff) return record.every((b) => b === 0xff);
  return false;
}

export function parseIddbRadioReply(
  sidecars: Record<string, Uint8Array>,
): IddbRadioReply | undefined {
  const raw = sidecars[RADIOFOUNDRY_DEBUG_IDDB_SIDECAR];
  if (!raw || raw.length < 5) return undefined;
  const formatByte = raw[0]!;
  const format = formatByte === 0 ? null : String.fromCharCode(formatByte);
  const records = readU32(raw, 1);
  return { format, records };
}

function captureImageEnd(sidecars: Record<string, Uint8Array>, boardImageEnd: number): number {
  const info = sidecars[RADIOFOUNDRY_DEBUG_INFO_SIDECAR];
  const reported = info && info.length >= 20 ? readU32(info, 16) : boardImageEnd;
  return Math.min(reported, boardImageEnd);
}

function area1FromFlash(flash: Uint8Array): Uint8Array | undefined {
  const offset = DMR_ID_DATABASE_ADDRESS - FLASH_IMAGE_START;
  if (offset < 0 || offset >= flash.length) return undefined;
  return flash.subarray(offset, Math.min(flash.length, offset + DMR_ID_DATABASE_AREA1_BYTES));
}

interface DecodedRecords {
  ids: number[];
  texts: string[];
  blankAmongHeader: number;
  ascending: boolean;
  firstBreak?: { index: number; id: number; previous: number };
}

function recordBytesAt(
  index: number,
  area1: Uint8Array,
  area2: Uint8Array | undefined,
): Uint8Array | undefined {
  if (index < DMR_ID_DATABASE_AREA1_RECORDS) {
    const at = DMR_ID_DATABASE_HEADER_BYTES + index * DMR_ID_DATABASE_RECORD_BYTES;
    if (at + DMR_ID_DATABASE_RECORD_BYTES > area1.length) return undefined;
    return area1.subarray(at, at + DMR_ID_DATABASE_RECORD_BYTES);
  }
  const area2Index = index - DMR_ID_DATABASE_AREA1_RECORDS;
  if (!area2) return undefined;
  const at = area2Index * DMR_ID_DATABASE_RECORD_BYTES;
  if (at + DMR_ID_DATABASE_RECORD_BYTES > area2.length) return undefined;
  return area2.subarray(at, at + DMR_ID_DATABASE_RECORD_BYTES);
}

function decodeCapturedRecords(
  headerCount: number,
  area1: Uint8Array,
  area2: Uint8Array | undefined,
): DecodedRecords {
  const ids: number[] = [];
  const texts: string[] = [];
  let blankAmongHeader = 0;

  for (let index = 0; index < headerCount; index += 1) {
    const rec = recordBytesAt(index, area1, area2);
    if (!rec) break;
    if (isBlankRecord(rec)) {
      blankAmongHeader += 1;
      continue;
    }
    ids.push(readRecordId(rec));
    texts.push(unpackText(rec.subarray(3)));
  }

  let ascending = true;
  let firstBreak: DecodedRecords['firstBreak'];
  for (let i = 1; i < ids.length; i += 1) {
    if (ids[i]! <= ids[i - 1]!) {
      ascending = false;
      firstBreak = { index: i, id: ids[i]!, previous: ids[i - 1]! };
      break;
    }
  }

  return { ids, texts, blankAmongHeader, ascending, firstBreak };
}

function buildLookup(
  ids: readonly number[],
  texts: readonly string[],
  headerCount: number,
  area2Captured: boolean,
) {
  const record = (index: number): { id: number; text: string } | undefined => {
    if (index < 0 || index >= ids.length) return undefined;
    return { id: ids[index]!, text: texts[index]! };
  };

  const lookup = (
    id: number,
  ):
    | { found: true; index: number; text: string }
    | { found: false; nearest?: { index: number; id: number } }
    | { notCaptured: true } => {
    if (ids.length === 0) return { found: false };
    if (id > ids[ids.length - 1]! && !area2Captured && headerCount > ids.length) {
      return { notCaptured: true };
    }
    let lo = 0;
    let hi = ids.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const midId = ids[mid]!;
      if (midId === id) return { found: true, index: mid, text: texts[mid]! };
      if (midId < id) lo = mid + 1;
      else hi = mid - 1;
    }
    const nearestIndex = lo < ids.length ? lo : ids.length - 1;
    const nearest = { index: nearestIndex, id: ids[nearestIndex]! };
    return { found: false, nearest };
  };

  return { record, lookup };
}

/** Classify and decode the DMR ID database held in a RadioFoundry debug capture. */
export function radioFoundryIdDatabaseView(
  archive: RadioFoundryIdDatabaseArchive,
): RadioFoundryIdDatabaseView {
  const radio = parseIddbRadioReply(archive.sidecars);
  const flash = archive.regions[RADIOFOUNDRY_REGION.flash];
  if (!flash) return { status: 'not-captured' };

  const board = radioFoundryCableBoardForModelId(archive.manifest.radioModelId);
  const imageEnd = board
    ? captureImageEnd(archive.sidecars, board.limits.IMAGE_END)
    : DMR_ID_DATABASE_ADDRESS;

  const area1 = area1FromFlash(flash);
  if (!area1 || area1.length < DMR_ID_DATABASE_HEADER_BYTES) {
    return { status: 'not-captured' };
  }

  const header = area1.subarray(0, DMR_ID_DATABASE_HEADER_BYTES);
  const headerHex = hexBytes(header);

  if (header[0] !== 0x49 || header[1] !== 0x64) {
    return { status: 'none', headerHex, radio };
  }

  const format = String.fromCharCode(header[2]!);
  const headerCount = readU32(header, 8);

  if (format === 'n') {
    return {
      status: 'voice-prompt-area2',
      headerCount,
      area2Address: FORMAT_N_AREA2_VOICE_PROMPT,
      radio,
    };
  }

  if (format === 'C') {
    return { status: 'compact', headerHex, radio };
  }

  if (format !== 'N') {
    return {
      status: 'unreadable',
      reason: `Format byte ${JSON.stringify(format)} is not supported for decode.`,
      radio,
    };
  }

  if (header[3] !== DMR_ID_DATABASE_SIZE_BYTE) {
    return {
      status: 'unreadable',
      reason: `Record size byte 0x${(header[3] ?? 0).toString(16)} is not the expected 27-byte format.`,
      radio,
    };
  }

  const area2Region = archive.regions[RADIOFOUNDRY_REGION.area2];
  const area2Captured = area2Region != null && area2Region.length > 0;

  const recordsEnd =
    DMR_ID_DATABASE_ADDRESS +
    DMR_ID_DATABASE_HEADER_BYTES +
    headerCount * DMR_ID_DATABASE_RECORD_BYTES;
  const radioReadsIt = recordsEnd <= imageEnd;

  const decoded = decodeCapturedRecords(
    headerCount,
    area1,
    area2Captured ? area2Region : undefined,
  );

  let area1Decoded = 0;
  let area2DecodedCount = 0;
  for (let index = 0; index < headerCount; index += 1) {
    const rec = recordBytesAt(index, area1, area2Captured ? area2Region : undefined);
    if (!rec) break;
    if (isBlankRecord(rec)) continue;
    if (index < DMR_ID_DATABASE_AREA1_RECORDS) area1Decoded += 1;
    else if (area2Captured) area2DecodedCount += 1;
  }
  const needsArea2 = headerCount > DMR_ID_DATABASE_AREA1_RECORDS;
  const area2Records: number | 'not-captured' = !needsArea2
    ? 0
    : area2Captured
      ? area2DecodedCount
      : 'not-captured';

  const { record, lookup } = buildLookup(decoded.ids, decoded.texts, headerCount, area2Captured);

  return {
    status: 'ok',
    format: 'N',
    headerCount,
    radio,
    area1Records: area1Decoded,
    area2Records,
    radioReadsIt,
    integrity: {
      ascending: decoded.ascending,
      firstBreak: decoded.firstBreak,
      blankRecords: decoded.blankAmongHeader,
    },
    record,
    lookup,
  };
}
