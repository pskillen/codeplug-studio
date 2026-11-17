import { describe, expect, it } from 'vitest';
import { diffDecoded, type DebugCompareArchive } from '../../../debugCompare/index.ts';
import { diffUv5rMiniChannels } from './channelDiff.ts';
import { uv5rMiniCompareAdapter } from './compare.ts';

const SIZE = 32;
const at = (slot: number) => (slot - 1) * SIZE;

function record(name: string): Uint8Array {
  const r = new Uint8Array(SIZE);
  r.set([0x00, 0x00, 0x00, 0x10], 0);
  r.set([0x00, 0x00, 0x00, 0x10], 4);
  r[12] = 0x01;
  r.set(new TextEncoder().encode(name).subarray(0, 12), 20);
  return r;
}

function base(): Uint8Array {
  const img = new Uint8Array(0x10000);
  img.fill(0xff, 0, 999 * SIZE);
  img.set(record('TEST A'), at(1));
  img.set(record('TEST B'), at(2));
  img.set(record('TEST C'), at(3));
  return img;
}

const archive = (clone: Uint8Array): DebugCompareArchive => ({
  manifest: {
    radioModelId: 'baofeng-uv-5r-mini',
    regions: [],
  } as unknown as DebugCompareArchive['manifest'],
  regions: { clone },
  sidecars: {},
});

const channels = (a: Uint8Array, b: Uint8Array) =>
  diffDecoded(
    uv5rMiniCompareAdapter.decoded!(archive(a)),
    uv5rMiniCompareAdapter.decoded!(archive(b)),
  ).records.filter((r) => r.domainId === 'channels' && r.kind !== 'unchanged');

describe('UV-5R Mini decoded snapshot', () => {
  it('reports no channel change for identical reads', () => {
    expect(channels(base(), base())).toEqual([]);
  });

  it('matches channelDiff: renamed slot is one changed record with the name field', () => {
    const b = base();
    b.set(record('TEST X'), at(2));
    const legacy = diffUv5rMiniChannels(base(), b).changes[0]!;
    const [r] = channels(base(), b);
    expect(channels(base(), b)).toHaveLength(1);
    expect(r).toMatchObject({ slot: legacy.slot, kind: 'changed' });
    expect(r!.fields.filter((f) => f.kind === 'changed').map((f) => f.label)).toEqual(
      legacy.fields,
    );
    expect(r!.identityA).toEqual({ name: legacy.nameBefore });
    expect(r!.identityB).toEqual({ name: legacy.nameAfter });
  });

  it('reads a filled slot as added and an emptied one as removed', () => {
    const filled = base();
    filled.set(record('NEW'), at(4));
    const [added] = channels(base(), filled);
    expect(added).toMatchObject({ slot: 4, kind: 'added' });
    expect(diffUv5rMiniChannels(base(), filled).changes[0]!.kind).toBe('filled');
    const emptied = base();
    emptied.fill(0xff, at(3), at(3) + SIZE);
    const [removed] = channels(base(), emptied);
    expect(removed).toMatchObject({ slot: 3, kind: 'removed' });
    expect(diffUv5rMiniChannels(base(), emptied).changes[0]!.kind).toBe('emptied');
  });

  it('keeps slots 248 and 249 diffed with a caveat', () => {
    const b = base();
    b[at(248) + 0x10] = 0x42;
    const [r] = channels(base(), b);
    expect(r).toMatchObject({ slot: 248 });
    expect(r!.caveats[0]).toMatch(/kept apart/);
    expect(diffUv5rMiniChannels(base(), b).special[0]!.diffOffsets).toEqual([0x10]);
    expect(r!.fields.some((f) => f.kind === 'changed')).toBe(true);
  });

  it('reports an unmodelled-byte change as its own field, and its absence means the bytes held', () => {
    const b = base();
    b[at(1) + 12] = 0x09;
    const [r] = channels(base(), b);
    expect(r!.fields.filter((f) => f.kind === 'changed').map((f) => f.label)).toEqual(['scode']);
  });

  it('is empty without a full read', () => {
    expect(uv5rMiniCompareAdapter.decoded!(archive(new Uint8Array(100)))).toEqual([]);
  });

  it('diffs settings frame fields', () => {
    const b = base();
    b[0x9000 + 1] ^= 0x01;
    const diff = diffDecoded(
      uv5rMiniCompareAdapter.decoded!(archive(base())),
      uv5rMiniCompareAdapter.decoded!(archive(b)),
    );
    expect(diff.domains.find((d) => d.id === 'settings')!.changed).toBe(1);
  });

  it('carries the absolute address of changed settings, VFO and calibration fields', () => {
    const b = base();
    b[0x9000 + 1] ^= 0x01;
    b[0x8000 + 0] ^= 0x01;
    b[0xf255] ^= 0x01;
    const diff = diffDecoded(
      uv5rMiniCompareAdapter.decoded!(archive(base())),
      uv5rMiniCompareAdapter.decoded!(archive(b)),
    );
    const addresses = (domain: string) =>
      diff.records
        .filter((r) => r.domainId === domain)
        .flatMap((r) => r.fields.filter((f) => f.kind === 'changed').map((f) => f.address));
    expect(addresses('settings')).toEqual(expect.arrayContaining([0x9001, 0x8000]));
    expect(addresses('calibration')).toEqual([0xf255]);
  });
});
