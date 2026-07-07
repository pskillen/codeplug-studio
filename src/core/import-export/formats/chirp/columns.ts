/** CHIRP CSV column headers — shared between import and export adapters. */

import type { ImportEntityKind } from '../../types.ts';

export const CHIRP_HEADERS = [
  'Location',
  'Name',
  'Frequency',
  'Duplex',
  'Offset',
  'Tone',
  'rToneFreq',
  'cToneFreq',
  'DtcsCode',
  'DtcsPolarity',
  'RxDtcsCode',
  'CrossMode',
  'Mode',
  'TStep',
  'Skip',
  'Power',
  'Comment',
  'URCALL',
  'RPT1CALL',
  'RPT2CALL',
  'DVCODE',
] as const;

export const CHIRP_COL = Object.fromEntries(CHIRP_HEADERS.map((h) => [h, h])) as Record<
  (typeof CHIRP_HEADERS)[number],
  string
>;

export function isChirpHeaderRow(headers: string[]): boolean {
  const trimmed = headers.map((h) => h.trim());
  return (
    trimmed.includes('Location') &&
    trimmed.includes('Name') &&
    trimmed.includes('Frequency') &&
    trimmed.includes('Duplex') &&
    trimmed.includes('Mode')
  );
}

/** Classify an uploaded file for CHIRP batch import (Phase 6b). */
export function detectKind(_fileName: string, headerRow: string[]): ImportEntityKind | 'unknown' {
  return isChirpHeaderRow(headerRow) ? 'channels' : 'unknown';
}
