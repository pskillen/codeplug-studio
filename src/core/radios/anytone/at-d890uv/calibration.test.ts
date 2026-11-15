import { describe, expect, it } from 'vitest';
import {
  AT_D890_TRIM_NEUTRAL,
  AT_D890_TUNE_UNIT_BYTES,
  atD890CalibrationCorrection,
  atD890CalibrationTableValue,
  decodeAtD890Calibration,
} from './calibration.ts';

/** Synthetic tune unit: distinct byte patterns per field, nothing from a real radio. */
function golden(): Uint8Array {
  const b = new Uint8Array(AT_D890_TUNE_UNIT_BYTES).fill(0xee);
  const u16 = (offset: number, value: number) => {
    b[offset] = value & 0xff;
    b[offset + 1] = value >> 8;
  };
  u16(0x000, AT_D890_TRIM_NEUTRAL);
  [0x10, 0x20, 0x30, 0x40].forEach((v, i) => (b[0x002 + i] = v));
  [0x50, 0x60, 0x70, 0x80].forEach((v, i) => (b[0x102 + i] = v));
  u16(0x010, 0x0102);
  u16(0x012, 0x0304);
  u16(0x014, 0x0506);
  u16(0x016, 0x0708);
  u16(0x116, 0x1112);
  u16(0x118, 0x1314);
  u16(0x11a, 0x1516);
  u16(0x11c, 0x1718);
  u16(0x124, 0x2122);
  u16(0x126, 0x2324);
  u16(0x128, 0x2526);
  u16(0x12a, 0xfffe);
  for (let t = 0; t < 4; t++) {
    for (let i = 0; i < 121; i++) b[0xc00 + t * 0x100 + i] = (i + t * 7) & 0xff;
    for (let i = 0; i < 45; i++) b[0x1000 + t * 0x100 + i] = 200 + i - t;
    for (let i = 0; i < 25; i++) b[0x1400 + t * 0x100 + i] = 100 + i * 2 + t;
  }
  return b;
}

const byId = <T extends { id: string }>(items: readonly T[], id: string) =>
  items.find((item) => item.id === id)!;

describe('decodeAtD890Calibration', () => {
  it('decodes every traced field from a golden synthetic unit', () => {
    const cal = decodeAtD890Calibration(golden());
    expect(cal.availability).toBe('captured');
    expect(cal.capturedLength).toBe(AT_D890_TUNE_UNIT_BYTES);
    const trim = byId(cal.scalars, 'trim');
    expect(trim).toMatchObject({
      offset: 0,
      width: 2,
      value: 2000,
      byteOrder: 'assumed-little-endian',
      layout: 'traced',
      meaning: 'partially-traced',
      availability: 'captured',
    });
    expect(Array.from(trim.raw)).toEqual([0xd0, 0x07]);
    expect(trim.source.consumers).toContain('0x08047E10');
    expect(cal.scalars.filter((s) => s.group === 'power-reference').map((s) => s.value)).toEqual([
      0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80,
    ]);
    expect(
      Object.fromEntries(
        cal.scalars.filter((s) => s.width === 2).map((s) => [s.offset.toString(16), s.value]),
      ),
    ).toEqual({
      '0': 2000,
      '10': 0x0102,
      '12': 0x0304,
      '14': 0x0506,
      '16': 0x0708,
      '116': 0x1112,
      '118': 0x1314,
      '11a': 0x1516,
      '11c': 0x1718,
      '124': 0x2122,
      '126': 0x2324,
      '128': 0x2526,
      '12a': 0xfffe,
    });
    expect(cal.tables).toHaveLength(12);
    const uhf2 = byId(cal.tables, 'uhf-power-2');
    expect(uhf2).toMatchObject({ offset: 0xe00, length: 121, referenceIndex: 40, selection: 2 });
    expect(uhf2.values[0]).toBe(14);
    expect(uhf2.values[120]).toBe(134);
    expect(uhf2.source.consumers).toEqual(['0x0803AAF8', '0x0811A75C', '0x08123864']);
    const vhf3 = byId(cal.tables, 'vhf-power-3');
    expect(vhf3).toMatchObject({ offset: 0x1300, length: 45, referenceIndex: 9 });
    expect(vhf3.values[9]).toBe(206);
    const flat = cal.tables.filter((t) => t.group === 'flatness');
    expect(flat.map((t) => [t.offset, t.band, t.path, t.referenceIndex])).toEqual([
      [0x1400, 'uhf', 'main', 8],
      [0x1500, 'vhf-220', 'main', 5],
      [0x1600, 'uhf', 'sub', 8],
      [0x1700, 'vhf-220', 'sub', 5],
    ]);
    expect(
      flat.every((t) => t.values.length === 25 && t.values.every((v) => v !== undefined)),
    ).toBe(true);
  });

  it('keeps unknown bytes, including noted ones, as unknown ranges', () => {
    const cal = decodeAtD890Calibration(golden());
    const notes = cal.unknown.flatMap((r) => r.notes.map((n) => n.offset));
    expect(notes).toEqual([0x028, 0x200, 0x201, 0x207]);
    expect(cal.unknown[0]).toMatchObject({ offset: 0x006, end: 0x010 });
    expect(cal.unknown.at(-1)).toMatchObject({ offset: 0x1719, end: AT_D890_TUNE_UNIT_BYTES });
    const covered =
      cal.unknown.reduce((n, r) => n + r.end - r.offset, 0) +
      cal.scalars.reduce((n, s) => n + s.width, 0) +
      cal.tables.reduce((n, t) => n + t.length, 0);
    expect(covered).toBe(AT_D890_TUNE_UNIT_BYTES);
  });

  it('reports nothing captured for undefined or empty input', () => {
    for (const input of [undefined, new Uint8Array(0)]) {
      const cal = decodeAtD890Calibration(input);
      expect(cal.availability).toBe('not-captured');
      expect(
        cal.scalars.every((s) => s.value === undefined && s.availability === 'not-captured'),
      ).toBe(true);
      expect(cal.tables.every((t) => t.values.every((v) => v === undefined))).toBe(true);
    }
  });

  it('leaves a half-captured u16 unavailable while keeping its captured byte', () => {
    const cal = decodeAtD890Calibration(golden().subarray(0, 1));
    const trim = byId(cal.scalars, 'trim');
    expect(trim.availability).toBe('partial');
    expect(trim.value).toBeUndefined();
    expect(Array.from(trim.raw)).toEqual([0xd0]);
    expect(cal.availability).toBe('partial');
  });

  it('preserves missing positions of a truncated table and the missing reference entry', () => {
    const cal = decodeAtD890Calibration(golden().subarray(0, 0xc00 + 20));
    const t = byId(cal.tables, 'uhf-power-0');
    expect(t.availability).toBe('partial');
    expect(t.values.slice(0, 20).every((v) => v !== undefined)).toBe(true);
    expect(t.values.slice(20).every((v) => v === undefined)).toBe(true);
    expect(t.values).toHaveLength(121);
    expect(atD890CalibrationCorrection(t.values, 5, t.referenceIndex)).toBeUndefined();
    expect(byId(cal.tables, 'uhf-power-1').availability).toBe('not-captured');
  });

  it('keeps captured zero and 0xFF as actual values', () => {
    const b = new Uint8Array(0x20);
    b[0x002] = 0xff;
    b[0x003] = 0x00;
    b[0x010] = 0xff;
    b[0x011] = 0xff;
    const cal = decodeAtD890Calibration(b);
    expect(byId(cal.scalars, 'uhf-power-ref-0').value).toBe(0xff);
    expect(byId(cal.scalars, 'uhf-power-ref-1').value).toBe(0);
    expect(byId(cal.scalars, 'uhf-squelch-main').value).toBe(0xffff);
    expect(byId(cal.scalars, 'trim').value).toBe(0);
  });
});

describe('atD890CalibrationTableValue', () => {
  const values = [5, 10, undefined, 250];
  it('rejects out-of-range, fractional and nonfinite indexes without wrapping', () => {
    for (const index of [-1, values.length, 1.5, Number.NaN, Infinity, -Infinity])
      expect(atD890CalibrationTableValue(values, index)).toBeUndefined();
  });
  it('returns first, last and missing entries as stored', () => {
    expect(atD890CalibrationTableValue(values, 0)).toBe(5);
    expect(atD890CalibrationTableValue(values, 3)).toBe(250);
    expect(atD890CalibrationTableValue(values, 2)).toBeUndefined();
  });
  it('keeps negative corrections signed', () => {
    expect(atD890CalibrationCorrection(values, 0, 3)).toBe(-245);
    expect(atD890CalibrationCorrection(values, 3, 0)).toBe(245);
    expect(atD890CalibrationCorrection(values, 1, 1)).toBe(0);
  });
});
