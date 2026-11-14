import { describe, expect, it } from 'vitest';

import {
  decodeUv5rMiniCalibration,
  UV5R_MINI_CALIBRATION_END,
  UV5R_MINI_CALIBRATION_LAYOUT,
  UV5R_MINI_CALIBRATION_START,
  uv5rMiniPaAddress,
  uv5rMiniPaPointMhz,
  UV5R_MINI_PA_SEGMENTS,
} from './calibrationLayout.ts';
import { UV5R_MINI_FULL_READ_SIZE } from './fullRead.ts';

/** Synthetic read: every byte is a function of its address, so a value says where it came from. */
function syntheticRead(): Uint8Array {
  const read = new Uint8Array(UV5R_MINI_FULL_READ_SIZE);
  for (let i = 0; i < read.length; i++) read[i] = (i * 13 + (i >> 8)) & 0xff;
  return read;
}

describe('UV5R_MINI_CALIBRATION_LAYOUT', () => {
  it('covers 0xF000–0xFFFF in address order with no gap or overlap', () => {
    let at = UV5R_MINI_CALIBRATION_START;
    for (const range of UV5R_MINI_CALIBRATION_LAYOUT) {
      expect(range.start, range.id).toBe(at);
      expect(range.end, range.id).toBeGreaterThan(range.start);
      at = range.end;
    }
    expect(at).toBe(UV5R_MINI_CALIBRATION_END);
  });

  it('puts each traced field where the layout table says', () => {
    const at = Object.fromEntries(
      UV5R_MINI_CALIBRATION_LAYOUT.map((x) => [x.id, [x.start, x.end - x.start]]),
    );
    expect(at.paBias).toEqual([0xf000, 0xc0]);
    expect(at.f0c0).toEqual([0xf0c0, 0x40]);
    expect(at.squelch0).toEqual([0xf100, 16]);
    expect(at.squelch1).toEqual([0xf110, 16]);
    expect(at.battery).toEqual([0xf200, 6]);
    expect(at.ctcssTx).toEqual([0xf211, 1]);
    expect(at.dcsTx).toEqual([0xf212, 1]);
    expect(at.afGain0).toEqual([0xf213, 1]);
    expect(at.afGain1).toEqual([0xf214, 1]);
    expect(at.trim).toEqual([0xf216, 1]);
    expect([at.filter0, at.filter1, at.filter2, at.filter3]).toEqual([
      [0xf21b, 1],
      [0xf21c, 1],
      [0xf21d, 1],
      [0xf21e, 1],
    ]);
    expect(at.bandLimits).toEqual([0xf230, 21]);
    expect(at.modelSuffix).toEqual([0xf250, 6]);
  });
});

describe('PA bias shape', () => {
  it('uses the segment formulas for MHz', () => {
    const mhz = UV5R_MINI_PA_SEGMENTS.map((s) => [
      uv5rMiniPaPointMhz(s, 0),
      uv5rMiniPaPointMhz(s, 1),
      uv5rMiniPaPointMhz(s, 15),
    ]);
    expect(mhz).toEqual([
      [130, 133, 175],
      [200, 205, 275],
      [350, 355, 425],
      [400, 410, 550],
    ]);
  });

  it('is segment-major: 3 rows of 16 per segment, 12 rows from 0xF000', () => {
    expect(uv5rMiniPaAddress(0, 0, 0)).toBe(0xf000);
    expect(uv5rMiniPaAddress(0, 1, 0)).toBe(0xf010);
    expect(uv5rMiniPaAddress(1, 0, 0)).toBe(0xf030);
    expect(uv5rMiniPaAddress(3, 2, 15)).toBe(0xf0bf);
  });
});

describe('decodeUv5rMiniCalibration', () => {
  it('reads every field from its address', () => {
    const read = syntheticRead();
    const cal = decodeUv5rMiniCalibration(read);

    expect(cal.paBias).toHaveLength(4);
    for (const seg of cal.paBias) {
      expect(seg.levels).toHaveLength(3);
      for (const line of seg.levels) {
        expect(line.points).toHaveLength(16);
        for (const p of line.points) {
          expect(p.address).toBe(uv5rMiniPaAddress(seg.segment.index, line.level, p.i));
          expect(p.value).toBe(read[p.address]);
          expect(p.mhz).toBe(uv5rMiniPaPointMhz(seg.segment, p.i));
        }
      }
    }

    expect(cal.squelch.map((s) => [s.start, Array.from(s.bytes)])).toEqual([
      [0xf100, Array.from(read.subarray(0xf100, 0xf110))],
      [0xf110, Array.from(read.subarray(0xf110, 0xf120))],
    ]);
    expect(cal.battery).toEqual({
      start: 0xf200,
      values: Array.from(read.subarray(0xf200, 0xf206)),
      blank: false,
    });
    expect(cal.values.map((v) => [v.address, v.value])).toEqual(
      [0xf211, 0xf212, 0xf213, 0xf214, 0xf21b, 0xf21c, 0xf21d, 0xf21e].map((a) => [a, read[a]]),
    );
    expect(cal.trim.address).toBe(0xf216);
    expect(cal.trim.value).toBe(read[0xf216]);
    expect(cal.region).toMatchObject({ address: 0xf255, value: read[0xf255] });
    expect(cal.texts.map((t) => [t.start, t.bytes.length])).toEqual([
      [0xf230, 21],
      [0xf250, 6],
    ]);
    // Hex covers everything else.
    const hexBytes = cal.hex.reduce((n, h) => n + h.bytes.length, 0);
    expect(cal.hex[0]).toMatchObject({ start: 0xf0c0, end: 0xf100, kind: 'partlyTraced' });
    expect(cal.hex.at(-1)).toMatchObject({ start: 0xf256, end: 0x10000, kind: 'untraced' });
    const traced = 0xc0 + 32 + 6 + 4 + 1 + 4 + 21 + 6;
    expect(hexBytes).toBe(0x1000 - traced);
  });

  it('reads six 0xFF battery bytes as blank', () => {
    const read = syntheticRead();
    read.fill(0xff, 0xf200, 0xf206);
    expect(decodeUv5rMiniCalibration(read).battery.blank).toBe(true);
    read[0xf203] = 0x80;
    expect(decodeUv5rMiniCalibration(read).battery.blank).toBe(false);
  });

  it('flags an erased calibration area', () => {
    const read = new Uint8Array(UV5R_MINI_FULL_READ_SIZE).fill(0xff);
    expect(decodeUv5rMiniCalibration(read).blank).toBe(true);
    read[0xf000] = 0x40;
    expect(decodeUv5rMiniCalibration(read).blank).toBe(false);
  });

  it.each([
    [0, -4, false],
    [5, -1.5, false],
    [8, 0, false],
    [12, 2, false],
    [16, 4, false],
    [17, 0, true],
    [0xff, 0, true],
  ])('reads trim byte %i as %f ppm (above 16: %s)', (byte, ppm, aboveRange) => {
    const read = syntheticRead();
    read[0xf216] = byte;
    expect(decodeUv5rMiniCalibration(read).trim).toMatchObject({ value: byte, ppm, aboveRange });
  });

  it('shows text as printable ASCII', () => {
    const read = syntheticRead();
    read.set([0x41, 0x42, 0x00, 0x43, 0xff, 0x7a], 0xf250);
    expect(decodeUv5rMiniCalibration(read).texts[1].ascii).toBe('AB.C.z');
  });

  it('refuses a short read', () => {
    expect(() => decodeUv5rMiniCalibration(new Uint8Array(0xf000))).toThrow(/no calibration area/);
  });

  it('does not alias the read', () => {
    const read = syntheticRead();
    const cal = decodeUv5rMiniCalibration(read);
    cal.squelch[0].bytes[0] ^= 0xff;
    expect(read[0xf100]).not.toBe(cal.squelch[0].bytes[0]);
  });
});
