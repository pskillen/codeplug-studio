/**
 * OpenGD77 User Database write verify: what a Write sent, in a form small enough to survive the
 * restart in `sessionStorage`, and the compare against the occupied bytes read back afterwards.
 *
 * The header (12 B) is kept in full. Entries are kept as one CRC-32 per FLASH-sector slice of the
 * occupied spans: a 69,600-entry database is about 1.9 MB, which as JSON would not fit the
 * browser's session storage quota. A mismatching sector is therefore reported with digests, not bytes.
 */

import { crc32Ieee } from '../../kit/checksums.ts';
import type { WriteVerifyMismatch, WriteVerifyRegionRow } from '../../writeVerify.ts';
import { OPENGD77_SECTOR, OPENUV380_USER_DB_HEADER_SIZE } from './constants.ts';
import { userDatabaseFlashSpans, type UserDatabaseFlashSpan } from './userDatabaseWrite.ts';
import type { OpenGd77UserDatabaseEncodeResult } from './userDatabaseCodec.ts';

export const OPENGD77_USER_DATABASE_VERIFY_REGION_ID = 'user-database';
export const OPENGD77_USER_DATABASE_VERIFY_GROUP_ID = 'user-database';
const REGION_LABEL = 'User Database';

/** JSON-safe description of the User Database bytes a Write sent. */
export interface OpenGd77UserDatabaseVerifySnapshot {
  /** Absolute address of the header (first byte of the first span). */
  readonly headerAbs: number;
  /** The 12 header bytes as sent. */
  readonly header: readonly number[];
  /** Occupied slices in read-back order (spans concatenated), one per FLASH sector touched. */
  readonly slices: readonly {
    readonly abs: number;
    readonly length: number;
    readonly crc32: number;
  }[];
}

export function buildUserDatabaseVerifySnapshot(
  encoded: OpenGd77UserDatabaseEncodeResult,
): OpenGd77UserDatabaseVerifySnapshot {
  const spans = userDatabaseFlashSpans(encoded);
  const slices: { abs: number; length: number; crc32: number }[] = [];
  for (const span of spans) {
    sliceSpanBySector(span, (abs, data) => {
      slices.push({ abs, length: data.length, crc32: crc32Ieee(data) });
    });
  }
  return {
    headerAbs: encoded.headerAbs,
    header: [...encoded.header.subarray(0, OPENUV380_USER_DB_HEADER_SIZE)],
    slices,
  };
}

function sliceSpanBySector(
  span: UserDatabaseFlashSpan,
  visit: (abs: number, data: Uint8Array) => void,
): void {
  const end = span.abs + span.data.length;
  let abs = span.abs;
  while (abs < end) {
    const sectorEnd = (Math.floor(abs / OPENGD77_SECTOR) + 1) * OPENGD77_SECTOR;
    const to = Math.min(end, sectorEnd);
    visit(abs, span.data.subarray(abs - span.abs, to - span.abs));
    abs = to;
  }
}

export interface UserDatabaseVerifyOutcome {
  readonly mismatches: readonly WriteVerifyMismatch[];
  /** Header plus slices compared. */
  readonly chunkCount: number;
  readonly region: WriteVerifyRegionRow;
}

function hex32(n: number): string {
  return `crc32:${n.toString(16).padStart(8, '0')}`;
}

/**
 * Compare read-back occupied bytes (header, then entries, as `downloadUserDatabaseOccupied` returns
 * them) with the snapshot. A header that does not match is reported alone and the entries are not
 * compared. With a good header, slices the read-back is too short to cover are `not_read`, never
 * fabricated.
 */
export function compareUserDatabaseReadback(
  snapshot: OpenGd77UserDatabaseVerifySnapshot,
  occupied: Uint8Array,
): UserDatabaseVerifyOutcome {
  const mismatches: WriteVerifyMismatch[] = [];
  const regionBase = {
    regionId: OPENGD77_USER_DATABASE_VERIFY_REGION_ID,
    regionLabel: REGION_LABEL,
  };

  const expectedHeader = Uint8Array.from(snapshot.header);
  if (occupied.length < expectedHeader.length) {
    mismatches.push({
      kind: 'not_read',
      address: snapshot.headerAbs,
      ...regionBase,
      expected: expectedHeader,
      actual: null,
    });
  } else {
    const actualHeader = occupied.subarray(0, expectedHeader.length);
    if (!expectedHeader.every((b, i) => b === actualHeader[i])) {
      mismatches.push({
        kind: 'mismatch',
        address: snapshot.headerAbs,
        ...regionBase,
        expected: expectedHeader,
        actual: actualHeader.slice(),
      });
    }
  }

  // A header that does not match is the finding: the entry slices are not meaningful against it
  // (a wiped header would otherwise add one "not read" row per sector).
  const headerBad = mismatches.length > 0;
  let offset = 0;
  for (const slice of headerBad ? [] : snapshot.slices) {
    const end = offset + slice.length;
    if (end > occupied.length) {
      mismatches.push({
        kind: 'not_read',
        address: slice.abs,
        ...regionBase,
        expected: new Uint8Array(0),
        actual: null,
        expectedDigest: hex32(slice.crc32),
      });
    } else {
      const actualCrc = crc32Ieee(occupied.subarray(offset, end));
      if (actualCrc !== slice.crc32) {
        mismatches.push({
          kind: 'mismatch',
          address: slice.abs,
          ...regionBase,
          expected: new Uint8Array(0),
          actual: new Uint8Array(0),
          expectedDigest: hex32(slice.crc32),
          actualDigest: hex32(actualCrc),
        });
      }
    }
    offset = end;
  }

  const chunkCount = 1 + snapshot.slices.length;
  const mismatched = mismatches.filter((m) => m.kind === 'mismatch').length;
  const notRead = mismatches.length - mismatched;
  return {
    mismatches,
    chunkCount,
    region: {
      id: OPENGD77_USER_DATABASE_VERIFY_REGION_ID,
      label: REGION_LABEL,
      group: OPENGD77_USER_DATABASE_VERIFY_GROUP_ID,
      bytesRead: occupied.length,
      stagedChunkCount: chunkCount,
      mismatchedChunks: mismatched,
      notReadChunks: notRead,
      status: mismatched > 0 ? 'mismatch' : notRead > 0 ? 'not_read' : 'match',
    },
  };
}
