import { describe, expect, it } from 'vitest';
import {
  AT_D890_TRIM_NEUTRAL,
  AT_D890_TUNE_UNIT_BYTES,
  atD890CalibrationCorrection,
  atD890TrimPpm,
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
      byteOrder: 'little-endian',
      layout: 'traced',
      meaning: 'traced',
      factoryLabel: 'FQCA (0x0C)',
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
    expect(uhf2.source.consumers).toEqual(['0x0811A75C', '0x0803AAF8', '0x0801694C']);
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

  it('names every loaded byte and leaves the never-loaded bytes as unused ranges', () => {
    const cal = decodeAtD890Calibration(golden());
    const sum = (items: readonly { length: number }[]) => items.reduce((n, i) => n + i.length, 0);
    const unused = cal.unused.reduce((n, r) => n + r.end - r.offset, 0);
    const named = sum(cal.fields);
    expect(named).toBe(289);
    expect(sum(cal.fields.filter((f) => f.kind !== 'field'))).toBe(77);
    expect(sum(cal.fields.filter((f) => f.kind === 'no-reader'))).toBe(36);
    expect(unused).toBe(261_057);
    expect(
      unused +
        named +
        cal.scalars.reduce((n, s) => n + s.width, 0) +
        cal.tables.reduce((n, t) => n + t.length, 0),
    ).toBe(AT_D890_TUNE_UNIT_BYTES);
    expect(cal.unused[0]).toMatchObject({ offset: 0x02a });
    expect(cal.unused.at(-1)?.end).toBe(AT_D890_TUNE_UNIT_BYTES);
    // No two named ranges overlap.
    const spans = [
      ...cal.scalars.map((f) => [f.offset, f.offset + f.width]),
      ...cal.tables.map((t) => [t.offset, t.offset + t.length]),
      ...cal.fields.map((f) => [f.offset, f.offset + f.length]),
    ].sort((x, y) => x[0]! - y[0]!);
    spans.slice(1).forEach((span, i) => expect(span[0]).toBeGreaterThanOrEqual(spans[i]![1]!));
  });

  it('puts the factory case 5B capture at +0x203 and the air-band 127 MHz point at +0x206', () => {
    const cal = decodeAtD890Calibration(golden());
    expect(byId(cal.fields, 'fm-rsi')).toMatchObject({
      offset: 0x203,
      factoryLabel: 'FM RSI (0x5B)',
    });
    expect(byId(cal.fields, 'air-bpf-127')).toMatchObject({ offset: 0x206, length: 2 });
  });

  it('decodes the big-endian regions big-endian and the little-endian regions little-endian', () => {
    const b = new Uint8Array(AT_D890_TUNE_UNIT_BYTES);
    b.set([0x12, 0x34], 0x40a); // BE
    b.set([0x12, 0x34], 0x1810); // LE
    b.set([0x12, 0x34], 0x40a);
    const cal = decodeAtD890Calibration(b);
    expect(byId(cal.fields, 'uhf-fsk-400')).toMatchObject({
      byteOrder: 'big-endian',
      value: 0x1234,
    });
    expect(byId(cal.fields, 'nx6-vhf-mod')).toMatchObject({
      byteOrder: 'little-endian',
      value: 0x3412,
    });
    // Multi-word blocks are not collapsed into one integer.
    expect(byId(cal.fields, 'bb-cfg-15').value).toBeUndefined();
  });

  it('labels power by tier, never by the shifted factory letters', () => {
    const cal = decodeAtD890Calibration(golden());
    expect(cal.scalars.filter((s) => s.id.startsWith('uhf-power-ref')).map((s) => s.label)).toEqual(
      [
        'UHF power reference, Low',
        'UHF power reference, Mid',
        'UHF power reference, High',
        'UHF power reference, Turbo',
      ],
    );
    expect(byId(cal.scalars, 'uhf-power-ref-0').factoryLabel).toBe('PASU (0x10)');
    expect(byId(cal.scalars, 'uhf-power-ref-3').factoryLabel).toBe('PAHU (0x0D)');
  });

  it('converts the trim to ppm around the neutral 2000', () => {
    expect(atD890TrimPpm(2000)).toBe(0);
    expect(atD890TrimPpm(2100)).toBeCloseTo(2.173, 2);
    expect(atD890TrimPpm(1900)).toBeCloseTo(-2.173, 2);
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
