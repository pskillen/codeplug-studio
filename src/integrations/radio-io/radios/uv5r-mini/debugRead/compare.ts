/**
 * Compare two decoded UV-5R Mini full reads with the runbook windows: the hashed spans byte for byte (calibration on
 * its own line), the four log sectors skipped, and the two frames inside them reported only.
 */

import {
  UV5R_MINI_CALIBRATION_SPAN_ID,
  UV5R_MINI_DEBUG_FRAMES,
  UV5R_MINI_DEBUG_LOG_SECTORS,
  UV5R_MINI_DEBUG_SPANS,
  type Uv5rMiniDebugSpan,
} from './spans.ts';

export type Uv5rMiniCompareLineKind = 'compared' | 'calibration' | 'frame' | 'skipped';

export interface Uv5rMiniCompareLine {
  kind: Uv5rMiniCompareLineKind;
  span: Uv5rMiniDebugSpan;
  /** Absolute offsets that differ, ascending. Empty for a skipped span. */
  diffOffsets: number[];
}

export interface Uv5rMiniCompareResult {
  lines: Uv5rMiniCompareLine[];
  /** True when every compared span and calibration are identical. Frames and skipped sectors don't count. */
  identical: boolean;
}

function diffOffsets(a: Uint8Array, b: Uint8Array, span: Uv5rMiniDebugSpan): number[] {
  const out: number[] = [];
  for (let i = span.start; i < span.end; i++) {
    if (a[i] !== b[i]) out.push(i);
  }
  return out;
}

export function compareUv5rMiniReads(a: Uint8Array, b: Uint8Array): Uv5rMiniCompareResult {
  const lines: Uv5rMiniCompareLine[] = [
    ...UV5R_MINI_DEBUG_SPANS.map((span) => ({
      kind: (span.id === UV5R_MINI_CALIBRATION_SPAN_ID
        ? 'calibration'
        : 'compared') as Uv5rMiniCompareLineKind,
      span,
      diffOffsets: diffOffsets(a, b, span),
    })),
    ...UV5R_MINI_DEBUG_FRAMES.map((span) => ({
      kind: 'frame' as const,
      span,
      diffOffsets: diffOffsets(a, b, span),
    })),
    ...UV5R_MINI_DEBUG_LOG_SECTORS.map((span) => ({
      kind: 'skipped' as const,
      span,
      diffOffsets: [],
    })),
  ];
  const identical = lines
    .filter((l) => l.kind === 'compared' || l.kind === 'calibration')
    .every((l) => l.diffOffsets.length === 0);
  return { lines, identical };
}
