import type {
  ByteComparison,
  ByteRun,
  CompareSection,
  DebugCompareArchive,
  RegionIdentity,
} from './types.ts';

/** More runs than this are counted but not listed, so a 14 MB diff cannot freeze the tab. */
export const MAX_RUNS_PER_SECTION = 10_000;

type ByteDiff = Pick<CompareSection, 'changed' | 'missing' | 'runs' | 'runsTruncated'>;

/** Differing bytes over the shared length, as runs at absolute addresses; a length gap is `missing`. */
export function diffBytes(
  a: Uint8Array,
  b: Uint8Array,
  base: number,
  maxRuns = MAX_RUNS_PER_SECTION,
): ByteDiff {
  const length = Math.min(a.length, b.length);
  const runs: ByteRun[] = [];
  let changed = 0;
  let truncated = false;
  let open: ByteRun | undefined;
  for (let i = 0; i < length; i++) {
    if (a[i] !== b[i]) {
      changed++;
      if (open) open.length++;
      else if (runs.length < maxRuns) {
        open = { start: base + i, length: 1 };
        runs.push(open);
      } else truncated = true;
    } else open = undefined;
  }
  return { changed, missing: Math.abs(a.length - b.length), runs, runsTruncated: truncated };
}

const NO_DIFF: ByteDiff = { changed: 0, missing: 0, runs: [], runsTruncated: false };

/**
 * One section per region id in either archive. A region is compared only when both sides name it
 * at the same address with the same, established address space and representation.
 */
export function regionSections(
  a: DebugCompareArchive,
  b: DebugCompareArchive,
  identity: (archive: DebugCompareArchive, id: string) => RegionIdentity | undefined = () =>
    undefined,
): ByteComparison {
  if (a.manifest.radioModelId !== b.manifest.radioModelId)
    return { error: 'Radio models differ; captures are incompatible.', sections: [] };
  const ids = new Set([
    ...a.manifest.regions.map((r) => r.id),
    ...b.manifest.regions.map((r) => r.id),
  ]);
  const sections = Array.from(ids, (id): CompareSection => {
    const left = a.manifest.regions.find((r) => r.id === id);
    const right = b.manifest.regions.find((r) => r.id === id);
    if (!left || !right || left.address !== right.address)
      return {
        ...NO_DIFF,
        id,
        regionId: id,
        label: left?.label ?? right?.label ?? id,
        kind: 'incomparable',
        reason: 'Region or starting offset differs',
        base: left?.address ?? right?.address ?? 0,
        missing: Math.max(left?.byteLength ?? 0, right?.byteLength ?? 0),
      };
    const x = identity(a, id);
    const y = identity(b, id);
    if (!x || !y || x.space !== y.space || x.representation !== y.representation)
      return {
        ...NO_DIFF,
        id,
        regionId: id,
        label: left.label,
        kind: 'incomparable',
        reason: 'Address space or byte representation is unknown or differs',
        base: left.address,
      };
    const bytesA = a.regions[id]!;
    const bytesB = b.regions[id]!;
    return {
      ...diffBytes(bytesA, bytesB, left.address),
      id,
      regionId: id,
      label: left.label,
      kind: 'compared',
      base: left.address,
      a: bytesA,
      b: bytesB,
    };
  });
  return { sections };
}

export type CompareVerdict = 'identical' | 'changed' | 'nothing-compared';

/**
 * Only `compared` sections decide. Nothing compared is never "identical"; reported and skipped
 * sections do not count either way.
 */
export function compareVerdict(c: ByteComparison): {
  verdict: CompareVerdict;
  changedBytes: number;
  changedSections: number;
  notCompared: readonly CompareSection[];
} {
  const compared = c.sections.filter((s) => s.kind === 'compared');
  const changedBytes = compared.reduce((n, s) => n + s.changed, 0);
  const changedSections = compared.filter((s) => s.changed > 0).length;
  // A missing tail on one side means the sides differ in length: not identical.
  const lengthGap = compared.some((s) => s.missing > 0);
  return {
    verdict: !compared.length
      ? 'nothing-compared'
      : changedBytes > 0 || lengthGap
        ? 'changed'
        : 'identical',
    changedBytes,
    changedSections,
    notCompared: c.sections.filter((s) => s.kind !== 'compared'),
  };
}

export const HEX_ROW_BYTES = 16;

/** One 16-byte row on an absolute 16-byte boundary; the first and last rows of a section may be short. */
export interface HexRow {
  /** Absolute address of the row's first byte (a multiple of 16). */
  address: number;
  /** Index into the section's `a` and `b` of the first shown byte. */
  offset: number;
  /** Shown bytes in this row, 1 to 16. */
  length: number;
  /** Differing bytes in this row. */
  changed: number;
}

export type HexHunk =
  | { kind: 'rows'; rows: readonly HexRow[] }
  /** A stretch of identical rows left out of the filtered view; `start`/`end` are inclusive addresses. */
  | { kind: 'identical'; start: number; end: number; rows: number };

/**
 * The changed rows of a section with `context` identical rows either side, merged into hunks, and
 * the identical stretches between them. Built from the section's runs, so it stays cheap for a
 * large section; rows past a truncated run list are not marked. Compares over the shared length only.
 */
export function hexHunks(s: CompareSection, opts: { context: number }): readonly HexHunk[] {
  const length = s.a && s.b ? Math.min(s.a.length, s.b.length) : 0;
  if (length === 0) return [];
  const first = Math.floor(s.base / HEX_ROW_BYTES);
  const last = Math.floor((s.base + length - 1) / HEX_ROW_BYTES);
  const changedByRow = new Map<number, number>();
  for (const run of s.runs) {
    const end = run.start + run.length;
    for (let r = Math.floor(run.start / HEX_ROW_BYTES); r * HEX_ROW_BYTES < end; r++) {
      const overlap =
        Math.min(end, (r + 1) * HEX_ROW_BYTES) - Math.max(run.start, r * HEX_ROW_BYTES);
      changedByRow.set(r, (changedByRow.get(r) ?? 0) + overlap);
    }
  }
  const context = Math.max(0, Math.floor(opts.context));
  const ranges: Array<[number, number]> = [];
  for (const r of Array.from(changedByRow.keys()).sort((x, y) => x - y)) {
    const lo = Math.max(first, r - context);
    const hi = Math.min(last, r + context);
    const tail = ranges[ranges.length - 1];
    if (tail && lo <= tail[1] + 1) tail[1] = Math.max(tail[1], hi);
    else ranges.push([lo, hi]);
  }
  const rowAt = (r: number): HexRow => {
    const start = Math.max(r * HEX_ROW_BYTES, s.base);
    const end = Math.min((r + 1) * HEX_ROW_BYTES, s.base + length);
    return {
      address: r * HEX_ROW_BYTES,
      offset: start - s.base,
      length: end - start,
      changed: changedByRow.get(r) ?? 0,
    };
  };
  const identical = (from: number, to: number): HexHunk => ({
    kind: 'identical',
    start: Math.max(from * HEX_ROW_BYTES, s.base),
    end: Math.min((to + 1) * HEX_ROW_BYTES, s.base + length) - 1,
    rows: to - from + 1,
  });
  const hunks: HexHunk[] = [];
  let next = first;
  for (const [lo, hi] of ranges) {
    if (lo > next) hunks.push(identical(next, lo - 1));
    hunks.push({
      kind: 'rows',
      rows: Array.from({ length: hi - lo + 1 }, (_, i) => rowAt(lo + i)),
    });
    next = hi + 1;
  }
  if (next <= last) hunks.push(identical(next, last));
  return hunks;
}
