import { describe, expect, it } from 'vitest';
import { syntheticLocalInfo, syntheticTune } from '../__fixtures__/rangeChangeFixtures.ts';
import { AtD890ScriptedPipe } from '../__fixtures__/scriptedPipe.ts';
import { verifyAtD890RangeChange } from './rangeChangeVerify.ts';

const LOCAL_INFO = 0x04f80000;
const TUNE = 0x04f00000;

function radio(localInfo: Uint8Array, tune: Uint8Array) {
  const pipe = new AtD890ScriptedPipe();
  pipe.readResponder = (addr, len) => {
    for (const [start, data] of [
      [LOCAL_INFO, localInfo],
      [TUNE, tune],
    ] as const) {
      const off = addr - start;
      if (off >= 0 && off + len <= data.length) return data.subarray(off, off + len);
    }
    return null;
  };
  return pipe;
}

const hasW = (p: AtD890ScriptedPipe) => p.writes.some((w) => w[0] === 0x57);

describe('verifyAtD890RangeChange', () => {
  const backupLi = syntheticLocalInfo(3);
  const backupTune = syntheticTune(3);

  it('serialMatches is true when the serial is unchanged and false when it differs', async () => {
    const same = await verifyAtD890RangeChange(radio(syntheticLocalInfo(7), syntheticTune(7)), {
      identBandCode: 7,
      backupLocalInfo: backupLi,
      target: 7,
    });
    expect(same.serialMatches).toBe(true);
    const other = syntheticLocalInfo(7);
    other[0x35] ^= 0xff;
    const r = await verifyAtD890RangeChange(radio(other, syntheticTune(7)), {
      identBandCode: 7,
      backupLocalInfo: backupLi,
      target: 7,
    });
    expect(r.serialMatches).toBe(false);
    expect(r.localInfoDiffs).toContain(0x35);
  });

  it('tune +0x700..+0x711 differing is reported (a known possible false positive)', async () => {
    const tune = syntheticTune(7);
    tune[0x700] ^= 0xff;
    const r = await verifyAtD890RangeChange(radio(syntheticLocalInfo(7), tune), {
      identBandCode: 7,
      backupLocalInfo: backupLi,
      backupTune,
      target: 7,
    });
    expect(r.tuneDiffs).toEqual([0x700]);
  });

  it('only +0x03 and tune +0x28 changed: clean', async () => {
    const li = syntheticLocalInfo(7);
    const tune = syntheticTune(7);
    const pipe = radio(li, tune);
    const r = await verifyAtD890RangeChange(pipe, {
      identBandCode: 7,
      backupLocalInfo: backupLi,
      backupTune,
      target: 7,
    });
    expect(r).toEqual({
      rangeIsTarget: true,
      rangeIsOld: false,
      serialMatches: true,
      localInfoDiffs: [],
      tuneDiffs: [],
      tuneChecked: true,
    });
    expect(hasW(pipe)).toBe(false);
  });

  it('reports an extra LocalInfo byte', async () => {
    const li = syntheticLocalInfo(7);
    li[0x04] = 0x09;
    const r = await verifyAtD890RangeChange(radio(li, syntheticTune(7)), {
      identBandCode: 7,
      backupLocalInfo: backupLi,
      backupTune,
      target: 7,
    });
    expect(r.localInfoDiffs).toEqual([0x04]);
  });

  it('reports an extra tune byte', async () => {
    const tune = syntheticTune(7);
    tune[0x1234] ^= 0xff;
    const r = await verifyAtD890RangeChange(radio(syntheticLocalInfo(7), tune), {
      identBandCode: 7,
      backupLocalInfo: backupLi,
      backupTune,
      target: 7,
    });
    expect(r.tuneDiffs).toEqual([0x1234]);
  });

  it('without backupTune the tune bank is not read', async () => {
    const pipe = radio(syntheticLocalInfo(7), syntheticTune(7));
    const r = await verifyAtD890RangeChange(pipe, {
      identBandCode: 7,
      backupLocalInfo: backupLi,
      target: 7,
    });
    expect(r.tuneChecked).toBe(false);
    expect(r.tuneDiffs).toEqual([]);
    const reads = pipe.writes.filter((w) => w[0] === 0x52);
    expect(reads.every((w) => w[1] === 0x04 && w[2] === 0xf8)).toBe(true);
    expect(hasW(pipe)).toBe(false);
  });

  it('the old range still in place: rangeIsOld', async () => {
    const r = await verifyAtD890RangeChange(radio(backupLi, backupTune), {
      identBandCode: 3,
      backupLocalInfo: backupLi,
      backupTune,
      target: 7,
    });
    expect(r.rangeIsOld).toBe(true);
    expect(r.rangeIsTarget).toBe(false);
  });
});
