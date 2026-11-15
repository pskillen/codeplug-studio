import type { DebugArchive } from './captureArchive.ts';
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
