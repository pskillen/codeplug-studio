/**
 * Compare two decoded UV-5R Mini full reads with the runbook windows: the hashed spans byte for byte (calibration on
 * its own line), the four log sectors skipped, and the two frames inside them reported only.
 */

import {
  diffBytes,
  type ByteComparison,
  type CompareSection,
  type DebugCompareAdapter,
} from '../../../debugCompare/index.ts';
import {
  UV5R_MINI_CALIBRATION_SPAN_ID,
  UV5R_MINI_DEBUG_FRAMES,
  UV5R_MINI_DEBUG_LOG_SECTORS,
  UV5R_MINI_DEBUG_SPANS,
  type Uv5rMiniDebugSpan,
} from './spans.ts';
import { uv5rMiniDecodedSnapshot } from './compareDecoded.ts';

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

const MINI_REASON = {
  skipped: 'Firmware log sector: the radio owns it, so a compare skips it',
  frame: 'Reported only: lives inside a log sector, never decides the verdict',
} as const;

/**
 * The same runbook windows as `compareUv5rMiniReads`, as neutral compare sections over two decoded
 * reads: spans and calibration are `compared`, frames `reported`, log sectors `skipped`.
 */
export function uv5rMiniCompareSections(a: Uint8Array, b: Uint8Array): ByteComparison {
  const section = (
    span: Uv5rMiniDebugSpan,
    kind: CompareSection['kind'],
    reason?: string,
  ): CompareSection => {
    const left = a.subarray(span.start, span.end);
    const right = b.subarray(span.start, span.end);
    return {
      ...(kind === 'skipped'
        ? { changed: 0, missing: 0, runs: [], runsTruncated: false }
        : diffBytes(left, right, span.start)),
      id: span.id,
      label: span.label,
      kind,
      reason,
      base: span.start,
      ...(kind === 'skipped' ? {} : { a: left, b: right }),
    };
  };
  return {
    sections: [
      ...UV5R_MINI_DEBUG_SPANS.map((s) => section(s, 'compared')),
      ...UV5R_MINI_DEBUG_FRAMES.map((s) => section(s, 'reported', MINI_REASON.frame)),
      ...UV5R_MINI_DEBUG_LOG_SECTORS.map((s) => section(s, 'skipped', MINI_REASON.skipped)),
    ],
  };
}

/** Compare adapter over two archives holding the decoded clone as region `clone`. */
export const uv5rMiniCompareAdapter: DebugCompareAdapter = {
  sections: (a, b) => {
    if (a.manifest.radioModelId !== b.manifest.radioModelId)
      return { error: 'Radio models differ; captures are incompatible.', sections: [] };
    const x = a.regions['clone'];
    const y = b.regions['clone'];
    if (!x || !y || x.length !== y.length)
      return { error: 'Both captures need the decoded clone of the same length.', sections: [] };
    return uv5rMiniCompareSections(x, y);
  },
  decoded: uv5rMiniDecodedSnapshot,
};
