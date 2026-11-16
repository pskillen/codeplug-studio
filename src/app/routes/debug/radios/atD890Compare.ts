import {
  diffBytes,
  type ByteComparison,
  type CompareSection,
  type DebugCompareAdapter,
} from '@integrations/radio-io/debugCompare/index.ts';
import type { DebugArchive } from './captureArchive.ts';
import { atD890DecodedSnapshot } from './atD890DecodedDiff.ts';
import {
  isAtD890ClassifiedRange,
  readAtD890Provenance,
  type AtD890ReadRange,
} from './atD890Provenance.ts';

/** Same or different responding unit, only ever from explicit evidence on both sides. */
export type AtD890UnitVerdict = 'same' | 'different' | 'unknown';

/** A contiguous run of differing bytes; the full bytes of each side stay available. */
export interface AtD890ChangedRun {
  start: number;
  length: number;
  before: Uint8Array;
  after: Uint8Array;
}

export interface AtD890ComparisonSpan {
  space: string;
  start: number;
  end: number;
  first?: AtD890ReadRange;
  second?: AtD890ReadRange;
  /** Differing bytes; undefined when either side is missing or ambiguous (incomparable). */
  changed?: number;
  /** Every differing byte, as runs. Present exactly when `changed` is. */
  runs?: readonly AtD890ChangedRun[];
  /**
   * Responding-unit verdict. Never inferred from byte equality, serials, labels or the expected
   * mapping: only both sides explicitly naming a responding unit gives Same or Different.
   */
  unitVerdict: AtD890UnitVerdict;
  /** Acquisition claims that differ between the sides, independent of the bytes. */
  provenanceDiffers: readonly string[];
}

export function unitVerdict(first?: AtD890ReadRange, second?: AtD890ReadRange): AtD890UnitVerdict {
  const a = first?.respondingUnit;
  const b = second?.respondingUnit;
  if (typeof a !== 'string' || typeof b !== 'string') return 'unknown';
  return a === b ? 'same' : 'different';
}

function provenanceDifferences(first?: AtD890ReadRange, second?: AtD890ReadRange): string[] {
  if (!first || !second) return [];
  const out: string[] = [];
  if (first.kind !== second.kind) out.push('acquisition kind');
  if (first.requestedUnit !== second.requestedUnit) out.push('requested unit');
  if (first.respondingUnit !== second.respondingUnit) out.push('responding unit claim');
  if (first.bothReadsMatched !== second.bothReadsMatched) out.push('repeat-read claim');
  return out;
}

/** Compare intersections in each acquisition space; absent ranges remain incomparable. */
export function compareAtD890(
  first: DebugArchive,
  second: DebugArchive,
): AtD890ComparisonSpan[] | undefined {
  const a = readAtD890Provenance(first);
  const b = readAtD890Provenance(second);
  if (!a || !b) return undefined;
  const space = (r: AtD890ReadRange) =>
    r.kind === 'sparse' ? 'sparse' : `vital:${r.requestedUnit}`;
  const result: AtD890ComparisonSpan[] = [];
  // Ranges outside the real map are unclassified: listed, never byte-compared.
  const unclassified = (ranges: readonly AtD890ReadRange[], side: 'first' | 'second') => {
    for (const r of ranges.filter((x) => !isAtD890ClassifiedRange(x)))
      result.push({
        space: 'unclassified',
        start: r.address,
        end: r.address + r.byteLength,
        [side]: r,
        unitVerdict: 'unknown',
        provenanceDiffers: [],
      });
  };
  unclassified(a.ranges, 'first');
  unclassified(b.ranges, 'second');
  const classified = (ranges: readonly AtD890ReadRange[]) => ranges.filter(isAtD890ClassifiedRange);
  const spaces = [...new Set([...classified(a.ranges), ...classified(b.ranges)].map(space))].sort();
  for (const name of spaces) {
    const left = classified(a.ranges).filter((r) => space(r) === name);
    const right = classified(b.ranges).filter((r) => space(r) === name);
    const bounds = [
      ...new Set([...left, ...right].flatMap((r) => [r.address, r.address + r.byteLength])),
    ].sort((x, y) => x - y);
    for (let i = 0; i < bounds.length - 1; i++) {
      const start = bounds[i]!;
      const end = bounds[i + 1]!;
      const aa = left.filter((r) => r.address <= start && r.address + r.byteLength >= end);
      const bb = right.filter((r) => r.address <= start && r.address + r.byteLength >= end);
      if (!aa.length && !bb.length) continue;
      // Ambiguous overlapping claims must not be silently merged.
      const x = aa.length === 1 ? aa[0] : undefined;
      const y = bb.length === 1 ? bb[0] : undefined;
      let changed: number | undefined;
      let runs: AtD890ChangedRun[] | undefined;
      if (x && y) {
        const firstBytes = first.regions[x.regionId]!;
        const secondBytes = second.regions[y.regionId]!;
        changed = 0;
        runs = [];
        let open: { start: number; length: number } | undefined;
        const close = () => {
          if (!open) return;
          const pick = (bytes: Uint8Array, base: number) =>
            bytes.slice(open!.start - base, open!.start - base + open!.length);
          runs!.push({
            ...open,
            before: pick(firstBytes, x.address),
            after: pick(secondBytes, y.address),
          });
          open = undefined;
        };
        for (let address = start; address < end; address++) {
          if (firstBytes[address - x.address] !== secondBytes[address - y.address]) {
            changed++;
            if (open) open.length++;
            else open = { start: address, length: 1 };
          } else close();
        }
        close();
      }
      result.push({
        space: name,
        start,
        end,
        first: x,
        second: y,
        changed,
        runs,
        unitVerdict: unitVerdict(x, y),
        provenanceDiffers: provenanceDifferences(x, y),
      });
    }
  }
  return result;
}

const formatRange = (start: number, end: number) =>
  `0x${start.toString(16).toUpperCase()}–0x${(end - 1).toString(16).toUpperCase()}`;

const NO_BYTES = { changed: 0, runs: [], runsTruncated: false } as const;

/**
 * One compare section per acquisition span, `space · range`. Spans outside the real map and spans
 * with missing or ambiguous bytes are incomparable; the rest are compared.
 */
export function atD890CompareSections(first: DebugArchive, second: DebugArchive): ByteComparison {
  const spans = compareAtD890(first, second);
  if (!spans)
    return {
      sections: [],
      error:
        'Provenance unavailable: the acquisition claim is missing, malformed or inconsistent with stored regions.',
    };
  return {
    sections: spans.map((span): CompareSection => {
      const x = span.first;
      const y = span.second;
      const base = {
        id: `${span.space}:${span.start}`,
        label: `${span.space} · ${formatRange(span.start, span.end)}`,
        base: span.start,
        regionId: x?.regionId ?? y?.regionId,
      };
      if (span.space === 'unclassified')
        return {
          ...base,
          ...NO_BYTES,
          kind: 'incomparable',
          reason: 'Outside the AT-D890UV memory map; unclassified, not compared',
          missing: 0,
        };
      if (span.changed === undefined || !x || !y)
        return {
          ...base,
          ...NO_BYTES,
          kind: 'incomparable',
          reason: 'Missing or ambiguous bytes',
          missing: span.end - span.start,
        };
      const a = first.regions[x.regionId]!.subarray(span.start - x.address, span.end - x.address);
      const b = second.regions[y.regionId]!.subarray(span.start - y.address, span.end - y.address);
      return { ...base, ...diffBytes(a, b, span.start), kind: 'compared', a, b };
    }),
  };
}

export const atD890CompareAdapter: DebugCompareAdapter = {
  sections: atD890CompareSections,
  decoded: atD890DecodedSnapshot,
  notes: [
    {
      title: 'Responding unit unknown',
      text: 'These byte comparisons do not establish which physical unit responded. Firmware may divert reads; equal bytes and repeated-read agreement do not prove unit identity.',
    },
  ],
};
