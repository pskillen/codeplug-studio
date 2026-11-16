import { describe, expect, it } from 'vitest';
import {
  RT95_CALIBRATION_LENGTH,
  RT95_PROGRAM_PASSWORD_ADDRESS,
} from '@core/radios/retevis/rt95/calibration.ts';
import { rt95CalibrationView, type Rt95CalibrationArchive } from './debugCalibrationView.ts';

const BASE = 0x3b00;
const put = (img: Uint8Array, address: number, bytes: ArrayLike<number>) =>
  img.set(Array.from(bytes), address - BASE);
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

/** Synthetic 0x4C0-byte calibration region with recognisable values (no operator data). */
function region(length = RT95_CALIBRATION_LENGTH): Uint8Array {
  const img = new Uint8Array(RT95_CALIBRATION_LENGTH);
  put(img, 0x3b20, ascii('SERIAL-123456789A'.slice(0, 16)));
  put(img, RT95_PROGRAM_PASSWORD_ADDRESS, [0x31, 0x32, 0x33, 0x34]);
  put(img, 0x3f81, [100, 110, 120]);
  put(img, 0x3fa1, [200, 210, 220]);
  put(img, 0x3f80, [0x42]); // FQC VHF
  for (let p = 0; p < 3; p++) {
    for (let i = 0; i < 39; i++) img[0x3cc0 + p * 0x40 + i - BASE] = 100 + p + (i - 19);
    for (let i = 0; i < 91; i++) img[0x3d80 + p * 0x80 + i - BASE] = 100 + p + (i - 45);
  }
  put(img, 0x3f20, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  put(img, 0x3f00, [0, 1, 1, 2, 2, 3, 3, 4, 4]);
  put(img, 0x3f40, [0x00, 0x14, 0x65, 0x20]); // VHF test RX, BCD 10 Hz
  return length === RT95_CALIBRATION_LENGTH ? img : img.slice(0, length);
}

function archive(bytes: Uint8Array | undefined, modelId = 'retevis-rt95'): Rt95CalibrationArchive {
  return {
    manifest: { radioModelId: modelId },
    regions: bytes ? { 'rt95-calibration': bytes } : {},
  };
}

describe('rt95CalibrationView', () => {
  it('is not-captured for another radio or a missing region', () => {
    expect(rt95CalibrationView(archive(region(), 'DM-32UV')).status.kind).toBe('not-captured');
    expect(rt95CalibrationView(archive(undefined)).status.kind).toBe('not-captured');
  });

  it('builds the VHF and UHF power charts with Low/Mid/High and MHz x', () => {
    const view = rt95CalibrationView(archive(region()));
    const vhf = view.charts.find((c) => c.id === 'power-vhf');
    const uhf = view.charts.find((c) => c.id === 'power-uhf');
    if (vhf?.kind !== 'frequency-curve' || uhf?.kind !== 'frequency-curve') throw new Error();
    expect(vhf.series.map((s) => [s.label, s.slot])).toEqual([
      ['Low', 0],
      ['Mid', 1],
      ['High', 2],
    ]);
    expect(vhf.series[0]!.points).toHaveLength(39);
    expect(vhf.series[0]!.points[0]!.x).toBe(136);
    expect(vhf.series[0]!.points[38]!.x).toBe(174);
    expect(uhf.series[0]!.points).toHaveLength(91);
    expect(uhf.series[0]!.points[90]!.x).toBe(490);
    expect(vhf.y.label).toBe('Drive (PWM counts)');
    // drive = row base + entry - entry at the reference index (19 = 155 MHz)
    expect(vhf.series[0]!.points[0]!.y).toBe(100 - 19);
    expect(vhf.series[0]!.points[19]!.y).toBe(100);
    expect(vhf.table.rows[19]).toMatchObject({ key: '155', mark: 'reference' });
    expect(vhf.table.columns.map((c) => c.id)).toEqual([
      'low-entry',
      'low-drive',
      'mid-entry',
      'mid-drive',
      'high-entry',
      'high-drive',
    ]);
    expect(vhf.table.columns[0]!.deltaFromRow).toBe(19);
    expect(vhf.table.columns[1]!.format).toBe('decimal');
  });

  it('builds squelch, S-meter (levels 1-8) and trim charts, and no battery', () => {
    const view = rt95CalibrationView(archive(region()));
    const sq = view.charts.find((c) => c.id === 'squelch-vhf');
    if (sq?.kind !== 'step-bars') throw new Error();
    expect(sq.bars.map((b) => b.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(sq.y.domain).toBe('auto');
    expect(sq.y.unit).toBe('dB, inferred');
    expect(view.charts.find((c) => c.id === 'smeter-uhf')?.kind).toBe('step-bars');
    const trim = view.charts.find((c) => c.id === 'trim-vhf');
    if (trim?.kind !== 'trim') throw new Error();
    expect(trim.raw).toBe(0x42);
    expect(trim.scale).toEqual({ min: 0, max: 255 });
    expect(trim.ppm).toBeUndefined();
    expect(view.charts.some((c) => c.kind === 'battery')).toBe(false);
  });

  it('shows the serial in full, band values side by side, password sensitive', () => {
    const view = rt95CalibrationView(archive(region()));
    const record = view.tables.find((t) => t.id === 'production-record')!;
    const serial = record.rows.find((r) => r.label === 'Serial Number')!;
    expect(serial.cells[0]!.decoded).toBe('SERIAL-123456789');
    const bands = {
      layout: view.tables.find((t) => t.id === 'band-power')!.layout,
      rows: view.tables.filter((t) => t.id.startsWith('band-')).flatMap((t) => t.rows),
    };
    expect(bands.layout).toEqual({ bands: ['VHF', 'UHF'] });
    expect(bands.rows.every((r) => r.cells.length === 2)).toBe(true);
    const pa = bands.rows.find((r) => r.label.startsWith('PA power Low'))!;
    expect(pa.cells.map((c) => c.value)).toEqual([100, 200]);
    const rx = bands.rows.find((r) => r.label.includes('test channel RX frequency, slice 0'))!;
    expect(rx.cells[0]!.decoded).toBe('1.46520 MHz');
    const pw = view.tables.find((t) => t.id === 'program-password')!;
    expect(pw.rows[0]!.cells[0]!.sensitive).toBe(true);
    expect(view.hex[0]!.sensitive).toEqual([{ start: RT95_PROGRAM_PASSWORD_ADDRESS, length: 4 }]);
  });

  it('merges unused ranges and keeps the whole region as one hex source', () => {
    const view = rt95CalibrationView(archive(region()));
    expect(view.unused![0]).toMatchObject({ start: '0x3B11', end: '0x3B13', bytes: 3 });
    expect(view.hex).toHaveLength(1);
    expect(view.hex[0]!.address).toBe(0x3b00);
    expect(view.hex[0]!.bytes).toHaveLength(RT95_CALIBRATION_LENGTH);
    expect(view.notice?.title).toBe('Not validated on hardware');
    expect(view.facts?.find((f) => f.label === 'Captured')?.value).toBe('1,216 of 1,216 bytes');
  });

  it('keeps missing bytes missing on a truncated read', () => {
    const view = rt95CalibrationView(archive(region(0x100)));
    expect(view.status.kind).toBe('ok');
    expect(view.charts.find((c) => c.id === 'power-vhf')).toBeUndefined();
    expect(view.charts.find((c) => c.id === 'squelch-vhf')).toBeUndefined();
    const bands = view.tables.find((t) => t.id === 'band-power')!;
    expect(bands.rows[0]!.cells[0]!.availability).toBe('not-captured');
  });

  it('lists the band-value rows by label, so a renamed or dropped core label fails here', () => {
    const view = rt95CalibrationView(archive(region()));
    const labels = view.tables
      .filter((t) => t.id.startsWith('band-'))
      .flatMap((t) => t.rows.map((r) => r.label));
    expect(labels).toEqual([
      'PA power Low (PAL)',
      'PA power Mid (PAM)',
      'PA power High (PAH)',
      'Squelch base (SQ)',
      'TX deviation 12.5 kHz (MODN)',
      'TX deviation 20 kHz (MODM)',
      'TX deviation 25 kHz (MODW)',
      'CTCSS deviation 12.5 kHz (CTCN)',
      'CTCSS deviation 20 kHz (CTCM)',
      'CTCSS deviation 25 kHz (CTCW)',
      'DCS deviation 12.5 kHz (DCSN)',
      'DCS deviation 20 kHz (DCSM)',
      'DCS deviation 25 kHz (DCSW)',
      'RSSI reference',
      'test channel RX frequency, slice 0',
      'test channel RX frequency, slice 1',
      'test channel RX frequency, slice 2',
      'test channel offset, slice 0',
      'test channel offset, slice 1',
      'test channel offset, slice 2',
    ]);
    expect(labels).toHaveLength(20);
  });
});
