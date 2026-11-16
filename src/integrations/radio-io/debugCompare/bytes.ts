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
