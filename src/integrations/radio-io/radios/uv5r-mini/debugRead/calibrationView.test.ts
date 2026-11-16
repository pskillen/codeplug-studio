import { describe, expect, it } from 'vitest';
import type {
  BatteryLadder,
  FrequencyCurve,
  StepBars,
  TrimView,
} from '../../../debugView/index.ts';
import {
  uv5rMiniCalibrationView,
  UV5R_MINI_CLONE_REGION_ID,
  type Uv5rMiniCalibrationArchive,
} from './calibrationView.ts';

/** A synthetic 64 KiB image with recognisable calibration values. Nothing from a radio. */
function image(): Uint8Array {
  const img = new Uint8Array(0x10000);
  img.fill(0xff, 0xf280);
  // PA bias: frame by power index (0xF000 High, 0xF040 level 2, 0xF080 Low), four 16-byte rows.
  for (const [frame, base] of [
    [0xf000, 100],
    [0xf040, 60],
    [0xf080, 20],
  ] as const)
    for (let row = 0; row < 4; row++)
      for (let i = 0; i < 16; i++) img[frame + row * 16 + i] = row === 3 ? 0 : base + row * 10 + i;
  for (let i = 0; i < 10; i++) {
    img[0xf0c0 + i] = 40 + i * 5; // open
    img[0xf0d0 + i] = 30 + i * 5; // close
  }
  for (let i = 0; i < 13; i++) img[0xf0e0 + i] = 2 + (i % 3); // UHF offsets
  img.set([1, 2, 3, 4, 5, 6], 0xf200);
  img[0xf210] = 0x2b;
  img[0xf211] = 0x11;
  img[0xf216] = 12;
  img.set([0x34, 0x30, 0x30, 0x1f], 0xf231); // band 1 low 3400? BCD pairs
  img.set([0x31, 0x32, 0x33, 0x34, 0x35], 0xf250);
  img[0xf255] = 0x35;
  return img;
}

function archive(
  bytes: Uint8Array | undefined,
  modelId = 'UV-5R Mini',
): Uv5rMiniCalibrationArchive {
  return {
    manifest: { radioModelId: modelId },
    regions: bytes ? { [UV5R_MINI_CLONE_REGION_ID]: bytes } : {},
  };
}

describe('uv5rMiniCalibrationView', () => {
  it('is not-captured for another radio, a missing region and a short region', () => {
    expect(uv5rMiniCalibrationView(archive(image(), 'DM-32UV')).status.kind).toBe('not-captured');
    expect(uv5rMiniCalibrationView(archive(undefined)).status.kind).toBe('not-captured');
    const short = uv5rMiniCalibrationView(archive(image().slice(0, 0x8000)));
    expect(short.status.kind).toBe('not-captured');
    expect(short.charts).toEqual([]);
  });

  it('draws PA bias per band with High, Low and level 2 against MHz', () => {
    const view = uv5rMiniCalibrationView(archive(image()));
    const ids = view.charts.map((c) => c.id);
    expect(ids.slice(0, 4)).toEqual(['pa-uhf', 'pa-vhf', 'pa-200', 'pa-350']);
    const uhf = view.charts.find((c) => c.id === 'pa-uhf') as FrequencyCurve;
    expect(uhf.series.map((s) => s.label)).toEqual(['High', 'Low', 'Level 2 (no menu entry)']);
    expect(uhf.series[0]!.points).toHaveLength(13);
    expect(uhf.series[0]!.points[0]).toEqual({ x: 400, y: 100 });
    expect(uhf.series[0]!.points[12]).toEqual({ x: 520, y: 112 });
    expect(uhf.x).toEqual({ label: 'Frequency', unit: 'MHz' });
    expect(uhf.y.label).toBe('Byte (unit unknown)');
    expect(uhf.about).toContain('0xF000');
    const vhf = view.charts.find((c) => c.id === 'pa-vhf') as FrequencyCurve;
    expect(vhf.series[1]!.points[1]!.x).toBe(133);
    expect(vhf.series[1]!.points[0]!.y).toBe(30);
    const b350 = view.charts.find((c) => c.id === 'pa-350') as FrequencyCurve;
    expect(b350.about).toContain('Not calibrated');
    expect(uhf.table.columns.map((c) => c.id)).toEqual(['mhz', 'level0', 'level1', 'level2']);
  });

  it('draws squelch open and close as levels 0-9 and offsets on an auto domain', () => {
    const view = uv5rMiniCalibrationView(archive(image()));
    const open = view.charts.find((c) => c.id === 'squelch-open') as StepBars;
    const close = view.charts.find((c) => c.id === 'squelch-close') as StepBars;
    expect(open.bars.map((b) => b.value)).toEqual([40, 45, 50, 55, 60, 65, 70, 75, 80, 85]);
    expect(close.bars[0]!.value).toBe(30);
    expect(open.bars).toHaveLength(10);
    const offsets = view.charts.filter((c) => c.id.startsWith('squelch-offset-')) as StepBars[];
    expect(offsets.map((c) => c.bars.length)).toEqual([13, 10, 13, 10]);
    expect(offsets.every((c) => c.y.domain === 'auto')).toBe(true);
    expect(offsets[0]!.bars[1]).toMatchObject({ label: '410', value: 3 });
    expect(offsets[1]!.bars[2]!.label).toBe('140');
  });

  it('draws the battery ladder and the trim in ppm', () => {
    const view = uv5rMiniCalibrationView(archive(image()));
    const battery = view.charts.find((c) => c.id === 'battery') as BatteryLadder;
    expect(battery.steps.map((s) => s.raw)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(battery.blank).toBeUndefined();
    const trim = view.charts.find((c) => c.id === 'trim') as TrimView;
    expect(trim.raw).toBe(12);
    expect(trim.scale).toEqual({ min: 0, max: 16, neutral: 8 });
    expect(trim.ppm).toEqual({ perStep: 0.5, span: 4 });
    expect(trim.outOfRange).toBeUndefined();

    const img = image();
    img.fill(0xff, 0xf200, 0xf206);
    img[0xf216] = 40;
    const odd = uv5rMiniCalibrationView(archive(img));
    expect((odd.charts.find((c) => c.id === 'battery') as BatteryLadder).blank).toContain('0xFF');
    expect((odd.charts.find((c) => c.id === 'trim') as TrimView).outOfRange).toContain('index 8');
  });

  it('builds the value, band-limit and text tables', () => {
    const view = uv5rMiniCalibrationView(archive(image()));
    expect(view.tables.map((t) => t.id)).toEqual(['single-values', 'band-limits', 'text-fields']);
    const single = view.tables[0]!;
    const mic = single.rows.find((r) => r.id === 'mic')!;
    expect(mic.cells[0]!.decoded).toContain('low 6 bits 43');
    expect(mic.address).toBe('0xF210');
    expect(single.rows.find((r) => r.id === 'ctcssTx')!.cells[0]).toMatchObject({ value: 0x11 });
    expect(single.rows.find((r) => r.id === 'region')!.cells[0]!.decoded).toContain(
      'band-edge table 5',
    );
    const limits = view.tables[1]!;
    expect(limits.layout).toEqual({ bands: ['Low', 'High'] });
    expect(limits.rows).toHaveLength(4);
    expect(view.tables[2]!.rows[0]!.cells[0]!.decoded).toBe('12345');
  });

  it('lists unused ranges and gives the area as one raw source with runs collapsed', () => {
    const view = uv5rMiniCalibrationView(archive(image()));
    expect(view.unused!.some((r) => r.start === '0xF280' && r.end === '0xFFFF')).toBe(true);
    expect(view.unused!.some((r) => r.why.startsWith('PA bias, UHF row'))).toBe(true);
    expect(view.hex).toHaveLength(1);
    expect(view.hex[0]).toMatchObject({ address: 0xf000 });
    expect(view.hex[0]!.bytes).toHaveLength(0x1000);
    expect(view.collapseRuns).toBe(true);
  });

  it('says so when the calibration reads as erased', () => {
    const img = image();
    img[0xf000] = 0xff;
    const view = uv5rMiniCalibrationView(archive(img));
    expect(view.notice!.lines[0]).toContain('0xF000 reads 0xFF');
  });

  it('keeps chart ids stable across reads so the overlay pairs', () => {
    const a = uv5rMiniCalibrationView(archive(image())).charts.map((c) => c.id);
    const other = image();
    other[0xf000] = 7;
    expect(uv5rMiniCalibrationView(archive(other)).charts.map((c) => c.id)).toEqual(a);
  });
});
