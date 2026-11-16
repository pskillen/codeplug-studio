import { describe, expect, it } from 'vitest';

import {
  decodeUv5rMiniCalibration,
  UV5R_MINI_CALIBRATION_END,
  UV5R_MINI_CALIBRATION_LAYOUT,
  UV5R_MINI_CALIBRATION_START,
  uv5rMiniPaAddress,
  uv5rMiniPaPointMhz,
  uv5rMiniCalibrationCounts,
  uv5rMiniRegionTable,
  UV5R_MINI_PA_FRAMES,
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
    expect(at.squelchOpen).toEqual([0xf0c0, 10]);
    expect(at.squelchClose).toEqual([0xf0d0, 10]);
    expect(at.squelchOffsetUhf).toEqual([0xf0e0, 16]);
    expect(at.squelchOffsetVhf).toEqual([0xf0f0, 16]);
    expect(at.squelchOffset200).toEqual([0xf100, 16]);
    expect(at.squelchOffset350).toEqual([0xf110, 13]);
    expect(at.battery).toEqual([0xf200, 6]);
    expect(at.mic).toEqual([0xf210, 1]);
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
    expect(at.modelSuffix).toEqual([0xf250, 5]);
    expect(at.region).toEqual([0xf255, 1]);
    expect(at.erased).toEqual([0xf280, 0xd80]);
  });

  it('keeps the mic byte out of the residue and calls unread ranges residue or erased', () => {
    const kinds = new Map(UV5R_MINI_CALIBRATION_LAYOUT.map((x) => [x.id, x.kind]));
    expect(kinds.get('mic')).toBe('value');
    expect(kinds.get('f206')).toBe('residue');
    expect(kinds.get('f120')).toBe('residue');
    expect(kinds.get('erased')).toBe('erased');
    const labels = UV5R_MINI_CALIBRATION_LAYOUT.filter((x) => x.kind === 'residue').map(
      (x) => x.label,
    );
    expect(new Set(labels)).toEqual(new Set(['Frame residue (no reader)']));
    expect(UV5R_MINI_CALIBRATION_LAYOUT.some((x) => /untraced|free/i.test(x.label + x.note))).toBe(
      false,
    );
  });

  it('counts fields, bytes in fields, residue and erased bytes over all 4,096 bytes', () => {
    const c = uv5rMiniCalibrationCounts();
    expect(c.fields).toEqual({ traced: 21, partly: 0, unknown: 0 });
    expect(c.bytesInFields).toBe(316);
    expect(c.residue).toBe(324);
    expect(c.erased).toBe(3456);
    expect(c.unknown).toBe(0);
    expect(c.bytesInFields + c.residue + c.erased).toBe(0x1000);
  });
});

describe('PA bias shape', () => {
  it('uses the band formulas for MHz', () => {
    const mhz = UV5R_MINI_PA_SEGMENTS.map((s) => [
      s.label,
      uv5rMiniPaPointMhz(s, 0),
      uv5rMiniPaPointMhz(s, 1),
      uv5rMiniPaPointMhz(s, 12),
    ]);
    expect(mhz).toEqual([
      ['UHF', 400, 410, 520],
      ['VHF', 130, 133, 166],
      ['200 MHz', 200, 205, 260],
      ['350 MHz', 350, 355, 410],
    ]);
    expect(UV5R_MINI_PA_SEGMENTS.map((s) => s.usedPoints)).toEqual([13, 16, 13, 13]);
    expect(UV5R_MINI_PA_SEGMENTS.map((s) => s.calibrated)).toEqual([true, true, true, false]);
  });

  it('is power-major: a frame per power index (F000 High, F080 Low, F040 level 2), UHF VHF 200 350 rows', () => {
    expect(uv5rMiniPaAddress(0, 0, 0)).toBe(0xf000);
    expect(uv5rMiniPaAddress(1, 0, 0)).toBe(0xf010);
    expect(uv5rMiniPaAddress(3, 0, 15)).toBe(0xf03f);
    expect(uv5rMiniPaAddress(0, 2, 0)).toBe(0xf040);
    expect(uv5rMiniPaAddress(0, 1, 0)).toBe(0xf080);
    expect(uv5rMiniPaAddress(3, 1, 15)).toBe(0xf0bf);
    expect(UV5R_MINI_PA_FRAMES.map((f) => [f.level, f.name, f.confidence])).toEqual([
      [0, 'High', 'traced'],
      [1, 'Low', 'traced'],
      [2, 'Level 2 (no menu entry)', 'partly'],
    ]);
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
          expect(p.used).toBe(p.i < seg.segment.usedPoints);
        }
      }
    }
    // UHF High row is the first row of the first frame, Low is the first row of F080.
    expect(cal.paBias[0].levels[0].points[0].address).toBe(0xf000);
    expect(cal.paBias[0].levels[1].points[0].address).toBe(0xf080);
    expect(cal.paBias[0].levels[2].points[0].address).toBe(0xf040);

    expect(cal.squelch.thresholds.map((s) => [s.start, s.bytes.length])).toEqual([
      [0xf0c0, 10],
      [0xf0d0, 10],
    ]);
    expect(cal.squelch.offsets.map((s) => [s.start, s.bytes.length, s.used])).toEqual([
      [0xf0e0, 16, 13],
      [0xf0f0, 16, 10],
      [0xf100, 16, 13],
      [0xf110, 13, 10],
    ]);
    expect(Array.from(cal.squelch.offsets[2].bytes)).toEqual(
      Array.from(read.subarray(0xf100, 0xf110)),
    );
    expect(cal.battery).toEqual({
      start: 0xf200,
      values: Array.from(read.subarray(0xf200, 0xf206)),
      blank: false,
    });
    expect(cal.values.map((v) => [v.address, v.value])).toEqual(
      [0xf210, 0xf211, 0xf212, 0xf213, 0xf214, 0xf21b, 0xf21c, 0xf21d, 0xf21e].map((a) => [
        a,
        read[a],
      ]),
    );
    expect(cal.values[0].label).toBe('Mic sensitivity');
    expect(cal.trim.address).toBe(0xf216);
    expect(cal.trim.value).toBe(read[0xf216]);
    expect(cal.region).toMatchObject({ address: 0xf255, value: read[0xf255] });
    expect(cal.texts.map((t) => [t.start, t.bytes.length])).toEqual([[0xf250, 5]]);
    expect(cal.bandLimits).toMatchObject({ start: 0xf230 });
    // Residue and erased cover everything else.
    const hexBytes = cal.hex.reduce((n, h) => n + h.bytes.length, 0);
    expect(cal.hex[0]).toMatchObject({ start: 0xf0ca, end: 0xf0d0, kind: 'residue' });
    expect(cal.hex.at(-1)).toMatchObject({ start: 0xf280, end: 0x10000, kind: 'erased' });
    expect(hexBytes).toBe(324 + 3456);
  });

  it('decodes band limits as BCD MHz pairs and marks a non-digit nibble', () => {
    const read = syntheticRead();
    // Bytes 1-4: 0136 0174; 6-9: 0400 0480; 11-14: 0A00 0200 (not BCD low); 17-20: 0350 0390.
    read.set([0x01, 0x36, 0x01, 0x74], 0xf231);
    read.set([0x04, 0x00, 0x04, 0x80], 0xf236);
    read.set([0x0a, 0x00, 0x02, 0x00], 0xf23b);
    read.set([0x03, 0x50, 0x03, 0x90], 0xf241);
    const { bands } = decodeUv5rMiniCalibration(read).bandLimits;
    expect(bands).toEqual([
      { index: 0, address: 0xf231, lowMhz: 136, highMhz: 174 },
      { index: 1, address: 0xf236, lowMhz: 400, highMhz: 480 },
      { index: 2, address: 0xf23b, lowMhz: null, highMhz: 200 },
      { index: 3, address: 0xf241, lowMhz: 350, highMhz: 390 },
    ]);
  });

  it('reads the region byte as a table: low nibble of an ASCII digit 0-8, else 0', () => {
    expect(uv5rMiniRegionTable(0x33)).toBe(3);
    expect(uv5rMiniRegionTable(0x38)).toBe(8);
    expect(uv5rMiniRegionTable(0x39)).toBe(0);
    expect(uv5rMiniRegionTable(0xff)).toBe(0);
    const read = syntheticRead();
    read[0xf255] = 0x35;
    expect(decodeUv5rMiniCalibration(read).region.table).toBe(5);
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
    read.set([0x41, 0x42, 0x00, 0x43, 0xff], 0xf250);
    expect(decodeUv5rMiniCalibration(read).texts[0].ascii).toBe('AB.C.');
  });

  it('refuses a short read', () => {
    expect(() => decodeUv5rMiniCalibration(new Uint8Array(0xf000))).toThrow(/no calibration area/);
  });

  it('does not alias the read', () => {
    const read = syntheticRead();
    const cal = decodeUv5rMiniCalibration(read);
    cal.squelch.offsets[2].bytes[0] ^= 0xff;
    expect(read[0xf100]).not.toBe(cal.squelch.offsets[2].bytes[0]);
  });
});
