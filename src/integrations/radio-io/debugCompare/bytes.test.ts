import { describe, expect, it } from 'vitest';
import {
  compareVerdict,
  diffBytes,
  regionSections,
  type CompareSection,
  type DebugCompareArchive,
  type RegionIdentity,
} from './index.ts';

const u = (...n: number[]) => Uint8Array.from(n);

function archive(
  model: string,
  regions: Record<string, { address: number; bytes: Uint8Array }>,
): DebugCompareArchive {
  return {
    manifest: {
      radioModelId: model,
      regions: Object.entries(regions).map(([id, r]) => ({
        id,
        label: id.toUpperCase(),
        address: r.address,
        byteLength: r.bytes.length,
        path: `regions/${id}.bin`,
        restoreRole: 'inspect-only',
      })),
    } as DebugCompareArchive['manifest'],
    regions: Object.fromEntries(Object.entries(regions).map(([id, r]) => [id, r.bytes])),
    sidecars: {},
  };
}

const known = (): RegionIdentity => ({ space: 's', representation: 'r' });

describe('diffBytes', () => {
  it('lists runs at absolute addresses', () => {
    expect(diffBytes(u(1, 2, 3, 4, 5), u(1, 9, 9, 4, 8), 0x100)).toEqual({
      changed: 3,
      missing: 0,
      runs: [
        { start: 0x101, length: 2 },
        { start: 0x104, length: 1 },
      ],
      runsTruncated: false,
    });
  });
  it('counts a missing tail as missing, not changed', () => {
    expect(diffBytes(u(1, 2, 3), u(1, 2), 0)).toMatchObject({ changed: 0, missing: 1, runs: [] });
  });
  it('caps runs but keeps exact counts', () => {
    const a = new Uint8Array(100);
    const b = new Uint8Array(100);
    for (let i = 0; i < 100; i += 2) b[i] = 1;
    const d = diffBytes(a, b, 0, 10);
    expect(d.runs).toHaveLength(10);
    expect(d).toMatchObject({ changed: 50, runsTruncated: true });
  });
});

describe('regionSections', () => {
  it('refuses different radio models', () => {
    const r = regionSections(archive('A', {}), archive('B', {}), known);
    expect(r.error).toMatch(/Radio models differ/);
    expect(r.sections).toEqual([]);
  });
  it('compares a region with established identity on both sides', () => {
    const a = archive('A', { p: { address: 16, bytes: u(1, 2, 3) } });
    const b = archive('A', { p: { address: 16, bytes: u(1, 4, 3, 7) } });
    expect(regionSections(a, b, known).sections[0]).toMatchObject({
      kind: 'compared',
      base: 16,
      changed: 1,
      missing: 1,
      runs: [{ start: 17, length: 1 }],
    });
  });
  it('marks unknown identity, moved or absent regions incomparable', () => {
    const a = archive('A', { p: { address: 0, bytes: u(1) }, q: { address: 0, bytes: u(1) } });
    const b = archive('A', { p: { address: 8, bytes: u(1) } });
    const sections = regionSections(a, b, known).sections;
    expect(sections.map((s) => s.kind)).toEqual(['incomparable', 'incomparable']);
    expect(regionSections(a, a).sections.every((s) => s.kind === 'incomparable')).toBe(true);
  });
});

describe('compareVerdict', () => {
  const sec = (kind: CompareSection['kind'], changed = 0, missing = 0): CompareSection => ({
    id: kind,
    label: kind,
    kind,
    base: 0,
    changed,
    missing,
    runs: [],
    runsTruncated: false,
  });
  it('nothing compared is never identical', () => {
    expect(compareVerdict({ sections: [] }).verdict).toBe('nothing-compared');
    expect(compareVerdict({ sections: [sec('incomparable'), sec('skipped')] }).verdict).toBe(
      'nothing-compared',
    );
  });
  it('reported and skipped sections do not decide', () => {
    const v = compareVerdict({ sections: [sec('compared'), sec('reported', 4), sec('skipped')] });
    expect(v.verdict).toBe('identical');
    expect(v.notCompared).toHaveLength(2);
  });
  it('counts changed bytes and sections from compared ones only', () => {
    expect(
      compareVerdict({ sections: [sec('compared', 3), sec('compared'), sec('reported', 9)] }),
    ).toMatchObject({ verdict: 'changed', changedBytes: 3, changedSections: 1 });
  });
  it('a length gap in a compared section is not identical', () => {
    expect(compareVerdict({ sections: [sec('compared', 0, 2)] }).verdict).toBe('changed');
  });
});
