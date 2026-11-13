/**
 * The UV-5R Mini full read's spans: the ones a runbook hashes and compares, the four firmware log sectors a compare
 * skips, and the two 64-byte frames inside them it reports on their own. Shapes only (address ranges and names).
 * Ends are exclusive.
 */

import { sha256HexSync } from '../firmwareUpdate/sha256Sync.ts';

export interface Uv5rMiniDebugSpan {
  id: string;
  label: string;
  start: number;
  end: number;
}

/** Hashed and compared. The calibration span is the last and is always reported on its own line. */
export const UV5R_MINI_DEBUG_SPANS: readonly Uv5rMiniDebugSpan[] = [
  { id: 'codeplug', label: 'Codeplug', start: 0x0000, end: 0x8000 },
  { id: 'a000', label: 'DTMF and extras', start: 0xa000, end: 0xb000 },
  { id: 'c000', label: 'MM9PDY data', start: 0xc000, end: 0xd000 },
  { id: 'e000', label: 'Reserved', start: 0xe000, end: 0xf000 },
  { id: 'calibration', label: 'Calibration', start: 0xf000, end: 0x10000 },
];

export const UV5R_MINI_CALIBRATION_SPAN_ID = 'calibration';

/** Firmware log sectors: the radio owns them, so a compare skips them whole. */
export const UV5R_MINI_DEBUG_LOG_SECTORS: readonly Uv5rMiniDebugSpan[] = [
  { id: 'log8000', label: 'Log sector', start: 0x8000, end: 0x9000 },
  { id: 'log9000', label: 'Log sector', start: 0x9000, end: 0xa000 },
  { id: 'logB000', label: 'Log sector', start: 0xb000, end: 0xc000 },
  { id: 'logD000', label: 'Log sector', start: 0xd000, end: 0xe000 },
];

/** The VFO and settings frames inside the first two log sectors: compared, reported, never a pass criterion. */
export const UV5R_MINI_DEBUG_FRAMES: readonly Uv5rMiniDebugSpan[] = [
  { id: 'vfo', label: 'VFO frame', start: 0x8000, end: 0x8040 },
  { id: 'settings', label: 'Settings frame', start: 0x9000, end: 0x9040 },
];

export interface Uv5rMiniSpanHash {
  span: Uv5rMiniDebugSpan;
  sha256: string;
}

/** `0x0000–0x7FFF` style: inclusive end, as the runbooks write it. */
export function formatUv5rMiniSpanRange(span: { start: number; end: number }): string {
  const h = (n: number) => `0x${n.toString(16).toUpperCase().padStart(4, '0')}`;
  return `${h(span.start)}–${h(span.end - 1)}`;
}

/** SHA-256 (hex) of each hashed span of a decoded 64 KiB read. */
export function hashUv5rMiniDebugSpans(decoded: Uint8Array): Uv5rMiniSpanHash[] {
  return UV5R_MINI_DEBUG_SPANS.map((span) => ({
    span,
    sha256: sha256HexSync(decoded.subarray(span.start, span.end)),
  }));
}
