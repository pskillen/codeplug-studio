import { describe, expect, it } from 'vitest';
import { compareAtD890SentinelSnapshots, labelForAtD890SentinelId } from './sentinelVerify.ts';
import { AT_D890_SENTINEL_EXTENTS } from './writableExtents.ts';

describe('compareAtD890SentinelSnapshots with settings patches', () => {
  function snapshot(): Map<string, Uint8Array> {
    const snap = new Map<string, Uint8Array>();
    for (const extent of AT_D890_SENTINEL_EXTENTS) {
      snap.set(extent.id, new Uint8Array(extent.length).fill(0x11));
    }
    return snap;
  }
  const stepKeys = [
    {
      fieldId: 'keyShortP1',
      address: 0x3500013,
      bytes: Uint8Array.of(14),
      mask: Uint8Array.of(0xff),
    },
    {
      fieldId: 'keyShortP2',
      address: 0x3500014,
      bytes: Uint8Array.of(13),
      mask: Uint8Array.of(0xff),
    },
  ];

  function patchedAfter(): Map<string, Uint8Array> {
    const after = snapshot();
    after.get('OptionalSettingsMain')![0x13] = 14;
    after.get('OptionalSettingsMain')![0x14] = 13;
    return after;
  }

  it('accepts exactly the patched bytes changing (the #1394 step-key case)', () => {
    expect(compareAtD890SentinelSnapshots(snapshot(), patchedAfter(), stepKeys)).toEqual({
      ok: true,
    });
  });

  it('without the patches the same change is a mismatch', () => {
    expect(compareAtD890SentinelSnapshots(snapshot(), patchedAfter()).ok).toBe(false);
  });

  it('fails when a patched byte did not take its new value', () => {
    expect(compareAtD890SentinelSnapshots(snapshot(), snapshot(), stepKeys).ok).toBe(false);
  });

  it('still fails on a collateral change in the same span', () => {
    const after = patchedAfter();
    after.get('OptionalSettingsMain')![0x05] = 0x99;
    expect(compareAtD890SentinelSnapshots(snapshot(), after, stepKeys)).toEqual({
      ok: false,
      mismatches: [
        {
          id: 'OptionalSettingsMain',
          label: labelForAtD890SentinelId('OptionalSettingsMain'),
        },
      ],
    });
  });

  it('still fails on a LocalInfo change', () => {
    const after = patchedAfter();
    after.get('LocalInfo')![0] = 0x00;
    const result = compareAtD890SentinelSnapshots(snapshot(), after, stepKeys);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.mismatches.map((m) => m.id)).toEqual(['LocalInfo']);
  });
});
