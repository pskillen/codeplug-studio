import { describe, expect, it } from 'vitest';
import type { RadioBackupRegionV1 } from '../../backup/types.ts';
import {
  atD890CalibrationView,
  selectAtD890TuneRegion,
  type AtD890CalibrationArchive,
} from './debugCalibrationView.ts';
import { AT_D890_VITAL_UNIT_BYTES } from './vitalBackup.ts';

const TUNE_A = 0x04f00000;

/** Synthetic tune bytes: trim, power references, per-tier ramps; nothing from a real radio. */
function tune(length = AT_D890_VITAL_UNIT_BYTES, trim = 2000) {
  const full = new Uint8Array(AT_D890_VITAL_UNIT_BYTES);
  full[0] = trim & 0xff;
  full[1] = trim >> 8;
  for (let n = 0; n < 4; n++) {
    full[0x002 + n] = 0x10 * (n + 1);
    full[0x102 + n] = 0x20 * (n + 1);
    for (let i = 0; i < 121; i++) full[0xc00 + n * 0x100 + i] = i + n;
    for (let i = 0; i < 45; i++) full[0x1000 + n * 0x100 + i] = 100 + i + n;
  }
  for (const base of [0x1400, 0x1500, 0x1600, 0x1700])
    for (let i = 0; i < 25; i++) full[base + i] = i;
  full[0x010] = 0x34; // UHF squelch main, little-endian 0x0134
  full[0x011] = 0x01;
  return full.slice(0, length);
}

function region(
  id: string,
  address: number,
  byteLength: number,
  overrides: Partial<RadioBackupRegionV1> = {},
): RadioBackupRegionV1 {
  return {
    id,
    label: id,
    address,
    byteLength,
    path: `regions/${id}.bin`,
    restoreRole: 'inspect-only',
    ...overrides,
  };
}

function archive(
  entries: readonly [RadioBackupRegionV1, Uint8Array][],
  model = 'AT-D890UV',
): AtD890CalibrationArchive {
  return {
    manifest: { radioModelId: model, regions: entries.map(([r]) => r) },
    regions: Object.fromEntries(entries.map(([r, bytes]) => [r.id, bytes])),
    source: 'file',
  };
}

const full = () => archive([[region('vital-tune-a', TUNE_A, AT_D890_VITAL_UNIT_BYTES), tune()]]);

describe('selectAtD890TuneRegion', () => {
  it('selects only vital-tune-a at its requested address', () => {
    expect(
      selectAtD890TuneRegion(archive([[region('vital-tune-a', TUNE_A, 0x40), tune(0x40)]])),
    ).toMatchObject({ status: 'ok', address: TUNE_A });
  });
  it('refuses a wrong address, role or model and does not decode other regions by label', () => {
    expect(
      selectAtD890TuneRegion(archive([[region('vital-tune-a', 0x04f40000, 16), tune(16)]])),
    ).toMatchObject({ status: 'refused' });
    expect(
      selectAtD890TuneRegion(
        archive([[region('vital-tune-a', TUNE_A, 16, { restoreRole: 'restorable' }), tune(16)]]),
      ),
    ).toMatchObject({ status: 'refused' });
    expect(
      selectAtD890TuneRegion(
        archive([[region('vital-tune-a', TUNE_A, 16), tune(16)]], 'retevis-rt95'),
      ),
    ).toMatchObject({ status: 'refused' });
    expect(
      selectAtD890TuneRegion(
        archive([[region('other', TUNE_A, 16, { label: 'Calibration (live)' }), tune(16)]]),
      ),
    ).toEqual({ status: 'not-captured', aliasPresent: false });
  });
  it('refuses malformed provenance: length mismatch or larger than one unit', () => {
    const a = archive([[region('vital-tune-a', TUNE_A, 16), tune(16)]]);
    expect(
      selectAtD890TuneRegion({
        ...a,
        manifest: { ...a.manifest, regions: [{ ...a.manifest.regions[0]!, byteLength: 32 }] },
      }),
    ).toMatchObject({ status: 'refused' });
    const big = new Uint8Array(AT_D890_VITAL_UNIT_BYTES + 16);
    expect(
      selectAtD890TuneRegion(archive([[region('vital-tune-a', TUNE_A, big.length), big]])),
    ).toMatchObject({ status: 'refused' });
  });
});

describe('atD890CalibrationView status', () => {
  it('is not-captured for tune-b alone, naming the alias; refused for bad provenance', () => {
    const alias = atD890CalibrationView(
      archive([[region('vital-tune-b', 0x04f40000, 32), tune(32)]]),
    );
    expect(alias.status.kind).toBe('not-captured');
    expect(alias.status.kind === 'not-captured' && alias.status.reason).toMatch(
      /Calibration B \(as returned\) is present but is not used/,
    );
    const bad = atD890CalibrationView(
      archive([[region('vital-tune-a', 0x04f40000, 16), tune(16)]]),
    );
    expect(bad.status.kind).toBe('refused');
    expect(bad.charts).toEqual([]);
  });
});

describe('atD890CalibrationView charts', () => {
  const view = atD890CalibrationView(full());
  const chart = (id: string) => view.charts.find((c) => c.id === id);

  it('has the stable chart ids and the trim', () => {
    expect(view.charts.map((c) => c.id)).toEqual([
      'power-uhf',
      'power-vhf-220',
      'squelch-flatness-uhf',
      'squelch-flatness-vhf-220',
      'trim',
    ]);
  });

  it('draws UHF power as Low/Mid/High/Turbo in MHz, discrete', () => {
    const c = chart('power-uhf');
    if (c?.kind !== 'frequency-curve') throw new Error();
    expect(c.series.map((s) => [s.label, s.slot])).toEqual([
      ['Low', 0],
      ['Mid', 1],
      ['High', 2],
      ['Turbo', 3],
    ]);
    expect(c.series[0]!.points).toHaveLength(121);
    expect(c.series[0]!.points[0]!.x).toBe(400);
    expect(c.series[0]!.points[120]!.x).toBe(520);
    expect(c.discrete).toBe(true);
    expect(c.table.rows[40]).toMatchObject({ key: '440', mark: 'reference' });
    expect(c.table.columns[0]!.deltaFromRow).toBe(40);
    expect(c.about).toContain('index = floor(f − 400)');
    expect(c.address).toBe('+0xC00–+0xF78');
  });

  it('maps VHF/220 power: 136 + i below index 39, then 220 MHz, with a gap between', () => {
    const c = chart('power-vhf-220');
    if (c?.kind !== 'frequency-curve') throw new Error();
    const xs = c.series[0]!.points.map((p) => p.x);
    expect(xs[0]).toBe(136);
    expect(xs[38]).toBe(174);
    expect(Number.isNaN(c.series[0]!.points[39]!.y)).toBe(true);
    expect(xs[40]).toBe(220);
    expect(xs.at(-1)).toBe(225);
    expect(c.table.rows[9]).toMatchObject({ key: '145', mark: 'reference' });
    expect(c.table.rows[39]!.key).toBe('220');
  });

  it('draws squelch flatness main (slot 0) and sub (slot 1)', () => {
    const c = chart('squelch-flatness-uhf');
    if (c?.kind !== 'frequency-curve') throw new Error();
    expect(c.series.map((s) => [s.id, s.slot])).toEqual([
      ['main', 0],
      ['sub', 1],
    ]);
    expect(c.series[0]!.points[1]!.x).toBe(405);
    const v = chart('squelch-flatness-vhf-220');
    if (v?.kind !== 'frequency-curve') throw new Error();
    expect(v.series[0]!.points.at(-1)!.x).toBe(220);
    expect(v.table.rows).toHaveLength(21);
  });

  it('shows trim against neutral 2000 with 0.0217 ppm a step and the editor range', () => {
    const t = chart('trim');
    if (t?.kind !== 'trim') throw new Error();
    expect(t.raw).toBe(2000);
    expect(t.scale).toEqual({ min: 0, max: 4000, neutral: 2000 });
    expect(t.ppm!.perStep).toBeCloseTo(0.0217, 4);
    expect(t.about).toContain('0–4000');
  });

  it('leaves missing entries as gaps and omits what a short read lacks', () => {
    const short = atD890CalibrationView(
      archive([[region('vital-tune-a', TUNE_A, 0xc10), tune(0xc10)]]),
    );
    const c = short.charts.find((x) => x.id === 'power-uhf');
    if (c?.kind !== 'frequency-curve') throw new Error();
    const pts = c.series[0]!.points;
    expect(pts.filter((p) => Number.isFinite(p.y))).toHaveLength(16);
    expect(pts.filter((p) => Number.isNaN(p.y)).length).toBe(105);
    expect(short.charts.find((x) => x.id === 'power-vhf-220')).toBeUndefined();
    expect(short.charts.find((x) => x.id === 'trim')).toBeDefined();
  });
});

describe('atD890CalibrationView tables', () => {
  const view = atD890CalibrationView(full());
  const table = (id: string) => view.tables.find((t) => t.id === id)!;

  it('lays out references by band, main and sub as rows', () => {
    expect(table('power-references').layout).toEqual({ bands: ['UHF', 'VHF/220'] });
    expect(table('power-references').rows.map((r) => r.cells.map((c) => c.value))).toEqual([
      [0x10, 0x20],
      [0x20, 0x40],
      [0x30, 0x60],
      [0x40, 0x80],
    ]);
    expect(table('squelch-references').layout).toEqual({ bands: ['UHF', 'VHF', '220'] });
    const main = table('squelch-references').rows[0]!;
    expect(main.label).toBe('Squelch reference, main');
    expect(main.cells[0]).toMatchObject({ value: 0x0134, format: 'decimal' });
    expect(table('meter-references').rows).toHaveLength(2);
  });

  it('folds the field tables and keeps loaded-no-reader apart', () => {
    expect(table('other-fields').folded).toBe(true);
    expect(table('loaded-no-reader').folded).toBe(true);
    expect(table('loaded-no-reader').rows.length).toBeGreaterThan(0);
    expect(table('other-fields').rows.some((r) => r.cells[0]!.raw)).toBe(true);
  });

  it('keeps unused ranges, the notice and the whole tune unit as one hex source', () => {
    expect(view.unused![0]).toMatchObject({ start: '+0x02A' });
    expect(view.notice?.title).toBe('Not validated on hardware');
    expect(view.hex).toHaveLength(1);
    expect(view.hex[0]).toMatchObject({ address: TUNE_A });
    expect(view.hex[0]!.bytes).toHaveLength(AT_D890_VITAL_UNIT_BYTES);
    expect(view.facts?.find((f) => f.label === 'Captured')?.value).toBe(
      '262,144 of 262,144 bytes (complete)',
    );
    expect(view.facts?.find((f) => f.label === 'Source')?.value).toBe('Local archive');
    expect(view.facts?.find((f) => f.label === 'Byte order')?.value).toMatch(
      /big-endian in \+0x300/,
    );
  });
});
