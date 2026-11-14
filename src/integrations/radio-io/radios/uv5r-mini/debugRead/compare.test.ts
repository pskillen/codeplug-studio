import { describe, expect, it } from 'vitest';

import { compareUv5rMiniReads } from './compare.ts';

function base(): Uint8Array {
  const a = new Uint8Array(0x10000);
  for (let i = 0; i < a.length; i++) a[i] = (i * 13) & 0xff;
  return a;
}

function line(result: ReturnType<typeof compareUv5rMiniReads>, start: number) {
  return result.lines.find((l) => l.span.start === start && l.kind !== 'skipped')!;
}

describe('compareUv5rMiniReads', () => {
  it('says identical for two equal reads', () => {
    const r = compareUv5rMiniReads(base(), base());
    expect(r.identical).toBe(true);
    expect(r.lines.every((l) => l.diffOffsets.length === 0)).toBe(true);
  });

  it('finds a planted difference outside the skipped windows', () => {
    const b = base();
    b[0x1234] ^= 0x01;
    b[0xc010] ^= 0x80;
    const r = compareUv5rMiniReads(base(), b);
    expect(r.identical).toBe(false);
    expect(line(r, 0x0000).diffOffsets).toEqual([0x1234]);
    expect(line(r, 0xc000).diffOffsets).toEqual([0xc010]);
    expect(line(r, 0xf000).kind).toBe('calibration');
    expect(line(r, 0xf000).diffOffsets).toEqual([]);
  });

  it('ignores differences inside the log sectors', () => {
    const b = base();
    for (const off of [0x8100, 0x8fff, 0x9100, 0xb000, 0xdabc]) b[off] ^= 0xff;
    const r = compareUv5rMiniReads(base(), b);
    expect(r.identical).toBe(true);
    expect(r.lines.flatMap((l) => l.diffOffsets)).toEqual([]);
    expect(r.lines.filter((l) => l.kind === 'skipped').map((l) => l.span.start)).toEqual([
      0x8000, 0x9000, 0xb000, 0xd000,
    ]);
  });

  it('reports the two frames on their own, not as a difference', () => {
    const b = base();
    b[0x8010] ^= 0x01;
    b[0x903f] ^= 0x01;
    const r = compareUv5rMiniReads(base(), b);
    expect(r.identical).toBe(true);
    const frames = r.lines.filter((l) => l.kind === 'frame');
    expect(frames.map((l) => l.diffOffsets)).toEqual([[0x8010], [0x903f]]);
  });

  it('puts a calibration difference on the calibration line', () => {
    const b = base();
    b[0xf0aa] ^= 0x01;
    const r = compareUv5rMiniReads(base(), b);
    expect(r.identical).toBe(false);
    const cal = r.lines.filter((l) => l.kind === 'calibration');
    expect(cal).toHaveLength(1);
    expect(cal[0]!.diffOffsets).toEqual([0xf0aa]);
  });
});
