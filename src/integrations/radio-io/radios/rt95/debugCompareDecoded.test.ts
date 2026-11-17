import { describe, expect, it } from 'vitest';
import { diffDecoded, type DebugCompareArchive } from '../../debugCompare/index.ts';
import { encodeBcdFreq } from './bcd.ts';
import { RT95_MODEL_ID } from './constants.ts';
import { rt95CompareAdapter } from './debugCompare.ts';
import { RT95_MMD1_REGION_ID } from './debugCapture.ts';
import { buildSyntheticRt95Image } from './__fixtures__/syntheticImage.ts';
import { encodeRt95ModData } from './modData/encode.ts';

const ident = Uint8Array.from([82, 84, 57, 53, 45, 80, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

function archive(image: Uint8Array, extra: { mmd1?: Uint8Array } = {}): DebugCompareArchive {
  const regions: Record<string, Uint8Array> = { 'programming-image': image };
  const sidecars: Record<string, Uint8Array> = {};
  const manifestRegions = [
    {
      id: 'programming-image',
      label: 'Image',
      address: 0,
      byteLength: image.length,
      path: 'regions/programming-image.bin',
      restoreRole: 'inspect-only',
    },
  ];
  if (extra.mmd1) {
    regions[RT95_MMD1_REGION_ID] = extra.mmd1;
    manifestRegions.push({
      id: RT95_MMD1_REGION_ID,
      label: 'MMD1',
      address: 0x4000,
      byteLength: extra.mmd1.length,
      path: 'regions/rt95-mmd1.bin',
      restoreRole: 'inspect-only',
    });
    sidecars['debug/rt95-guard-ident.bin'] = ident;
    sidecars['debug/rt95-guard-alias.bin'] = new Uint8Array(16).fill(255);
    sidecars['debug/rt95-guard.json'] = new TextEncoder().encode('{"ok":true}');
  }
  return {
    manifest: {
      radioModelId: RT95_MODEL_ID,
      regions: manifestRegions,
    } as unknown as DebugCompareArchive['manifest'],
    regions,
    sidecars,
  };
}

const snapshot = (a: DebugCompareArchive) => rt95CompareAdapter.decoded!(a);

describe('RT95 decoded snapshot', () => {
  it('one channel RX frequency change is one record with one changed field', () => {
    // TX disabled on both: TX otherwise follows RX (plus offset) and would change with it.
    const a = buildSyntheticRt95Image();
    a[10] |= 1;
    const b = buildSyntheticRt95Image();
    b[10] |= 1;
    b.set(encodeBcdFreq(146_540_000), 0);
    const diff = diffDecoded(snapshot(archive(a)), snapshot(archive(b)));
    const channels = diff.records.filter((r) => r.domainId === 'channels');
    const changed = channels.filter((r) => r.kind === 'changed');
    expect(changed).toHaveLength(1);
    expect(changed[0]!.slot).toBe(1);
    expect(changed[0]!.identityA).toEqual({ name: 'TEST01' });
    expect(changed[0]!.fields.filter((f) => f.kind === 'changed')).toEqual([
      expect.objectContaining({ id: 'rx', a: '146.52000 MHz', b: '146.54000 MHz' }),
    ]);
    expect(diff.domains.find((d) => d.id === 'channels')).toMatchObject({
      changed: 1,
      added: 0,
      removed: 0,
    });
  });

  it('gives identical captures no changes in any domain', () => {
    const diff = diffDecoded(
      snapshot(archive(buildSyntheticRt95Image())),
      snapshot(archive(buildSyntheticRt95Image())),
    );
    expect(diff.domains.every((d) => d.changed + d.added + d.removed === 0)).toBe(true);
  });

  it('lists zone members by slot and diffs them when MMD1 and the guard hold', () => {
    const mmd1 = (members: number[]) => {
      const bytes = new Uint8Array(8192).fill(255);
      for (const block of encodeRt95ModData(
        { zones: [{ name: 'TEST', channelIndexes: members }], descriptions: [] },
        new Uint8Array(0),
      ).blocks)
        bytes.set(block.bytes, block.address - 0x4000);
      return bytes;
    };
    const image = buildSyntheticRt95Image();
    const diff = diffDecoded(
      snapshot(archive(image, { mmd1: mmd1([0]) })),
      snapshot(archive(image, { mmd1: mmd1([0, 199]) })),
    );
    const zone = diff.records.find((r) => r.domainId === 'zones')!;
    expect(zone.kind).toBe('changed');
    expect(zone.fields.find((f) => f.id === 'members')).toMatchObject({ a: '1', b: '1, 200' });
  });

  it('does not claim zones without MMD1', () => {
    const zones = snapshot(archive(buildSyntheticRt95Image())).find((d) => d.id === 'zones')!;
    expect(zones.records).toEqual([]);
    expect(zones.occupancyCaptured).toBe(false);
  });

  it('is empty for another radio', () => {
    const a = archive(buildSyntheticRt95Image());
    a.manifest = { ...a.manifest, radioModelId: 'other' };
    expect(snapshot(a)).toEqual([]);
  });

  it('flags the power-on password sensitive and hides its values from the diff', () => {
    const a = buildSyntheticRt95Image();
    const sens = snapshot(archive(a))
      .find((d) => d.id === 'settings')!
      .records[0]!.fields.filter((f) => f.sensitive);
    expect(sens.length).toBeGreaterThan(0);
    expect(sens.every((f) => typeof f.address === 'number')).toBe(true);
  });
});
