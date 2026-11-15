import type { DebugArchive } from './captureArchive.ts';
import { readAtD890Provenance, type AtD890ReadRange } from './atD890Provenance.ts';

export interface AtD890ComparisonSpan {
  space: string;
  start: number;
  end: number;
  first?: AtD890ReadRange;
  second?: AtD890ReadRange;
  changed?: number;
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
  const spaces = new Set([...a.ranges, ...b.ranges].map(space));
  const result: AtD890ComparisonSpan[] = [];
  for (const name of spaces) {
    const left = a.ranges.filter((r) => space(r) === name);
    const right = b.ranges.filter((r) => space(r) === name);
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
      if (x && y) {
        const firstBytes = first.regions[x.regionId]!;
        const secondBytes = second.regions[y.regionId]!;
        changed = 0;
        for (let address = start; address < end; address++)
          if (firstBytes[address - x.address] !== secondBytes[address - y.address]) changed++;
      }
      result.push({ space: name, start, end, first: x, second: y, changed });
    }
  }
  return result;
}
