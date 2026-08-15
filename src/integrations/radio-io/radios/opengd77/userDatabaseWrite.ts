/**
 * OpenGD77 User Database sidecar FLASH spans (outside the programming MemoryMap).
 * Cite: qdmr OpenUV380CallsignDB Offset; occupied bytes only — not size1.
 */

import { OPENGD77_SECTOR } from './constants.ts';
import { type OpenGd77UserDatabaseEncodeResult } from './userDatabaseCodec.ts';

/** FirmwareInfo features bit 1 — extended callsign DB (qdmr featureExtendedCallsignDB). */
export const OPENGD77_EXTENDED_CALLSIGN_DB_BIT = 1;

export function openGd77MissingExtendedCallsignDbWarning(features: number): string | undefined {
  if ((features & (1 << OPENGD77_EXTENDED_CALLSIGN_DB_BIT)) !== 0) return undefined;
  return 'This radio did not report extended callsign DB (FirmwareInfo bit 1). User Database write still uses qdmr OpenUV380 addresses — confirm on hardware before a large directory.';
}

export interface UserDatabaseFlashSpan {
  abs: number;
  data: Uint8Array;
}

export function userDatabaseFlashSpans(
  encoded: OpenGd77UserDatabaseEncodeResult,
): UserDatabaseFlashSpan[] {
  const entries0 = new Uint8Array(encoded.header.byteLength + encoded.entries0.byteLength);
  entries0.set(encoded.header, 0);
  entries0.set(encoded.entries0, encoded.header.byteLength);
  const spans: UserDatabaseFlashSpan[] = [{ abs: encoded.headerAbs, data: entries0 }];
  if (encoded.entries1.byteLength > 0) {
    spans.push({ abs: encoded.entries1Abs, data: encoded.entries1 });
  }
  return spans;
}

export function userDatabaseSectorAbsSet(spans: readonly UserDatabaseFlashSpan[]): number[] {
  const sectors = new Set<number>();
  for (const span of spans) {
    const start = Math.floor(span.abs / OPENGD77_SECTOR) * OPENGD77_SECTOR;
    const end = span.abs + span.data.byteLength;
    for (let sectorAbs = start; sectorAbs < end; sectorAbs += OPENGD77_SECTOR) {
      sectors.add(sectorAbs);
    }
  }
  return [...sectors].sort((a, b) => a - b);
}

export function overlayUserDatabaseSpanOnSector(
  sector: Uint8Array,
  sectorAbs: number,
  span: UserDatabaseFlashSpan,
): void {
  const spanEnd = span.abs + span.data.byteLength;
  const sectorEnd = sectorAbs + sector.byteLength;
  const from = Math.max(span.abs, sectorAbs);
  const to = Math.min(spanEnd, sectorEnd);
  if (to <= from) return;
  sector.set(span.data.subarray(from - span.abs, to - span.abs), from - sectorAbs);
}

/**
 * Occupied-sector payloads from encode only (0x00 fill). Do not RMW-read FLASH —
 * qdmr callsign upload writes encoded blocks after write_start, never a prior read
 * of 0x50000. Mixing 'R' then 'X' after codeplug sectors NACKs with '-'.
 */
export function buildUserDatabaseSectorPayloads(
  encoded: OpenGd77UserDatabaseEncodeResult,
): Map<number, Uint8Array> {
  const spans = userDatabaseFlashSpans(encoded);
  const payloads = new Map<number, Uint8Array>();
  for (const sectorAbs of userDatabaseSectorAbsSet(spans)) {
    const sector = new Uint8Array(OPENGD77_SECTOR);
    for (const span of spans) {
      overlayUserDatabaseSpanOnSector(sector, sectorAbs, span);
    }
    payloads.set(sectorAbs, sector);
  }
  return payloads;
}
