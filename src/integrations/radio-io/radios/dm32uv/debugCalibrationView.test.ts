import { describe, expect, it } from 'vitest';
import type { RadioBackupManifestV1, RadioBackupRegionV1 } from '../../backup/types.ts';
import type { FrequencyCurve, StepBars } from '../../debugView/index.ts';
import { sha256HexSync } from '../uv5r-mini/firmwareUpdate/sha256Sync.ts';
import { DM32_FACTORY_SECTOR_REGION_ID } from './calibrationDecode.ts';
import { DM32_FACTORY_SECTOR_ADDRESS } from './constants.ts';
import { dm32CalibrationView } from './debugCalibrationView.ts';
import type { Dm32CompareArchive } from './debugCompare.ts';
import { DM32_DEBUG_CAPTURE_PATH } from './debugCoverage.ts';

const BASE = 0x1000;
const TE = new TextEncoder();
const hexPairs = (digits: string) => digits.match(/../g)!.map((pair) => parseInt(pair, 16));
const bcd32 = (digits: string) => hexPairs(digits).reverse();

/** A synthetic calibration page: distinct valid values in the traced fields. Nothing from a radio. */
function goldenPage(): Uint8Array {
  const page = Uint8Array.from({ length: 4096 }, (_, i) => (i * 7 + 3) & 0xff);
  page.set([0x00, 0x40, 0x00, 0x47], 0x000);
  const uhf = ['40000000', '41750000', '43500000', '45250000', '47000000'];
  const vhf = ['13600000', '14550000', '15500000', '16450000', '17400000'];
  [0x300, 0x314].forEach((o) => uhf.forEach((f, i) => page.set(bcd32(f), o + i * 4)));
  [0x328, 0x33c].forEach((o) => vhf.forEach((f, i) => page.set(bcd32(f), o + i * 4)));
  page.set([0x58, 0x02, 0x7c, 0x02], 0x00c); // threshold 600, scale 636
  page[0xfff] = 0x02;
  return page;
}

function factoryBytes(): Uint8Array {
  const data = Uint8Array.from({ length: 4096 }, (_, i) => (i * 5 + 1) & 0xff);
  data[0x80] = 0x9e;
  data[0xa1] = 0xa5;
  data.set([0xd1, 0xd2, 0xd3, 0xd4], 0x10c);
  return data;
}

function archive(
  pages: Record<number, Uint8Array>,
  opts: { modelId?: string; factory?: Uint8Array; sidecars?: Record<string, Uint8Array> } = {},
): Dm32CompareArchive {
  const regions: RadioBackupRegionV1[] = [];
  const bytes: Record<string, Uint8Array> = {};
  const add = (id: string, address: number, data: Uint8Array) => {
    regions.push({
      id,
      label: 'Region',
      address,
      byteLength: data.length,
      path: `regions/${id}.bin`,
      restoreRole: 'inspect-only',
    });
    bytes[id] = data;
  };
  for (const [addr, data] of Object.entries(pages))
    add(`sparse-${Number(addr).toString(16)}`, Number(addr), data);
  if (opts.factory) add(DM32_FACTORY_SECTOR_REGION_ID, DM32_FACTORY_SECTOR_ADDRESS, opts.factory);
  const manifest = {
    format: 'radio-backup',
    version: 1,
    capturedAt: '2026-01-01T00:00:00.000Z',
    radioModelId: opts.modelId ?? 'DM-32UV',
    coverage: 'partial',
    addressBase: BASE,
    imageByteLength: 12 * 0x1000,
    regions,
  } as unknown as RadioBackupManifestV1;
  return {
    manifest,
    regions: bytes,
    sidecars: {
      [DM32_DEBUG_CAPTURE_PATH]: TE.encode(
        JSON.stringify({
          modelString: 'DP570UV',
          v0a: { start: BASE, end: BASE + 12 * 0x1000 - 1 },
          window: { start: BASE, end: BASE + 11 * 0x1000 },
          discovered: Object.entries(pages).map(([a, d]) => ({
            address: Number(a),
            tag: d[0xfff],
          })),
          channelCount: 0,
          extraReadTags: [],
          factory: opts.factory ? { status: 'kept' } : { status: 'not-kept', reason: 'mismatch' },
        }),
      ),
      ...opts.sidecars,
    },
  };
}

type View = ReturnType<typeof dm32CalibrationView>;
const chart = <T>(view: View, id: string) => view.charts.find((c) => c.id === id) as T;
const fact = (view: View, label: string) => view.facts?.find((f) => f.label === label)?.value;

describe('dm32CalibrationView', () => {
  it('is not captured for another radio, a missing page or a missing window', () => {
    expect(
      dm32CalibrationView(archive({ [BASE]: goldenPage() }, { modelId: 'retevis-rt95' })).status,
    ).toMatchObject({ kind: 'not-captured', reason: expect.stringContaining('not a DM-32UV') });
    const noPage = dm32CalibrationView(archive({ [BASE]: new Uint8Array(4096) }));
    expect(noPage.status).toMatchObject({
      kind: 'not-captured',
      reason: expect.stringContaining('No page tagged 0x02'),
    });
    const noWindow = archive({ [BASE]: goldenPage() });
    noWindow.manifest = { ...noWindow.manifest, addressBase: undefined };
    expect(dm32CalibrationView(noWindow).status).toMatchObject({
      kind: 'not-captured',
      reason: expect.stringContaining('does not state a valid configuration window'),
    });
  });

  it('draws power at the five TX points and squelch at the five RX points, with stable ids', () => {
    const view = dm32CalibrationView(archive({ [BASE]: goldenPage() }));
    expect(view.status).toEqual({ kind: 'ok' });
    expect(view.charts.map((c) => c.id)).toEqual([
      'power-uhf',
      'power-vhf',
      'squelch-uhf-1',
      'squelch-uhf-2',
      'squelch-vhf-1',
      'squelch-vhf-2',
      'squelch-air',
      'battery',
    ]);
    const power = chart<FrequencyCurve>(view, 'power-uhf');
    expect(power.series.map((s) => s.id)).toEqual(['low', 'mid', 'high']);
    expect(power.series[0]!.points.map((p) => p.x)).toEqual([400, 417.5, 435, 452.5, 470]);
    expect(power.series[0]!.points.map((p) => p.y)).toEqual(
      Array.from({ length: 5 }, (_, i) => goldenPage()[0x040 + i]),
    );
    expect(power.y.label).toBe('Drive (stored byte; DAC = v × 16)');
    expect(power.about).toMatch(/× 16/);
    const sq = chart<FrequencyCurve>(view, 'squelch-vhf-2');
    expect(sq.series.map((s) => s.id)).toEqual(['level1', 'level9']);
    expect(sq.series[1]!.points.map((p) => p.x)).toEqual([136, 145.5, 155, 164.5, 174]);
    expect(sq.series[1]!.points.map((p) => p.y)).toEqual(
      Array.from({ length: 5 }, (_, i) => goldenPage()[0x0ef + i]),
    );
    const air = chart<StepBars>(view, 'squelch-air');
    expect(air.bars).toHaveLength(10);
    expect(air.bars[0]).toMatchObject({ id: 'l1-p1', value: goldenPage()[0x080] });
    expect(power.table.columns.find((c) => c.id === 'low')!.values).toEqual(
      power.series[0]!.points.map((p) => p.y),
    );
    expect(view.charts.every((c) => c.kind !== 'trim')).toBe(true);
  });

  it('draws the battery threshold and scale, flagging a scale outside 1-1000', () => {
    const view = dm32CalibrationView(archive({ [BASE]: goldenPage() }));
    const battery = chart<{ steps: unknown[] }>(view, 'battery');
    expect(battery.steps).toEqual([
      { id: 'scale', label: 'ADC scale', raw: 636 },
      { id: 'threshold', label: 'Threshold', raw: 600, volts: 6 },
    ]);
    const bad = goldenPage();
    bad.set([0x00, 0x00], 0x00e);
    const badView = dm32CalibrationView(archive({ [BASE]: bad }));
    expect(chart<{ about: string }>(badView, 'battery').about).toMatch(/outside 1–1000/);
  });

  it('leaves a gap for a point that is not BCD and shows invalid BCD as raw, never zero', () => {
    const page = goldenPage();
    page.set([0xaa, 0x00, 0x00, 0x40], 0x314); // UHF TX point 1 not BCD
    page[0x001] = 0x4a;
    const view = dm32CalibrationView(archive({ [BASE]: page }));
    const power = chart<FrequencyCurve>(view, 'power-uhf');
    expect(power.series[0]!.points).toHaveLength(4);
    expect(power.table.columns[0]!.values[0]).toBeUndefined();
    const band = view.tables
      .find((t) => t.id === 'band-limits')!
      .rows.find((r) => r.id === 'uhf-band')!;
    expect(band.cells[0]!.decoded).toMatch(/invalid BCD/);
    expect(band.note).toMatch(/not BCD/);
    expect(band.cells[0]!.raw![1]).toBe(0x4a);
  });

  it('keeps the striped table fields with offset, bytes, raw, source and both confidences', () => {
    const view = dm32CalibrationView(archive({ [BASE]: goldenPage() }));
    expect(view.tables.map((t) => t.id)).toEqual([
      'band-limits',
      'frequency-points',
      'tx-power',
      'level-pairs',
      'scalars',
      'boot-scalars',
      'audio-levels',
      'adc-calibration',
      'tables',
      'adjust-mode-test-frequencies-observed',
    ]);
    const band = view.tables[0]!.rows[0]!;
    expect(band).toMatchObject({
      label: 'UHF band low / high',
      address: '+0x000, 4 bytes',
      confidence: { layout: 'traced', meaning: 'traced' },
    });
    expect(band.cells[0]!.decoded).toBe('400 – 470 MHz');
    expect(band.source).toMatch(/0x00038470/);
    const adc = view.tables.find((t) => t.id === 'adc-calibration')!.rows[0]!;
    expect(adc.confidence).toEqual({ layout: 'traced', meaning: 'partially-traced' });
    const thr = view.tables.find((t) => t.id === 'scalars')!.rows[0]!;
    expect(thr.cells[0]).toMatchObject({ value: 600, format: 'decimal' });
    expect(view.unused!.map((u) => u.start)).toEqual(['+0x0C0', '+0x188', '+0x210']);
    expect(view.unused![0]!.bytes).toBe(12);
  });

  it('states the layout basis and gives hashes and the sidecar cross-check', () => {
    const page = goldenPage();
    const a = archive(
      { [BASE]: page },
      {
        sidecars: {
          'calibration.json': TE.encode(
            JSON.stringify({ sha256: sha256HexSync(page), liveAddress: BASE }),
          ),
        },
      },
    );
    const view = dm32CalibrationView(a);
    expect(view.notice!.title).toBe('Not validated on hardware');
    expect(view.notice!.lines[0]).toMatch(/DM32\.01\.L01\.048/);
    expect(view.notice!.lines[0]).toMatch(/Captured V01 base version: Not captured/);
    expect(fact(view, 'SHA-256')).toBe(sha256HexSync(page));
    expect(fact(view, 'Cross-check')).toMatch(/Agrees with calibration\.json/);
    expect(fact(view, 'Live page')).toMatch(/0x00001000/);

    const differs = dm32CalibrationView({
      ...a,
      sidecars: {
        ...a.sidecars,
        'calibration.json': TE.encode(JSON.stringify({ sha256: '00'.repeat(32), liveAddress: 0 })),
      },
    });
    expect(fact(differs, 'Cross-check')).toMatch(/Differs from calibration\.json/);
    expect(differs.tables[0]!.rows[0]!.cells[0]!.decoded).toBe('400 – 470 MHz');

    const sidecars = { ...a.sidecars };
    delete sidecars['calibration.json'];
    expect(fact(dm32CalibrationView({ ...a, sidecars }), 'Cross-check')).toMatch(
      /calibration\.json absent/,
    );
  });

  it('lists a duplicate by address and hash without decoding it', () => {
    const dup = goldenPage();
    dup[0x040] = 0x11;
    const view = dm32CalibrationView(archive({ [BASE]: goldenPage(), [BASE + 0x1000]: dup }));
    expect(fact(view, 'Duplicate tag 0x02 page (not decoded)')).toContain(sha256HexSync(dup));
    expect(view.hex.map((h) => h.id)).toEqual(['live', `dup-${BASE + 0x1000}`]);
    expect(view.hex[0]!.address).toBe(BASE);
  });

  it('decodes the kept factory sector, with the anti-clone key only in the raw bytes', () => {
    const factory = factoryBytes();
    const view = dm32CalibrationView(archive({ [BASE]: goldenPage() }, { factory }));
    const table = view.tables.find((t) => t.id === 'factory-factory-options')!;
    expect(table.rows.map((r) => r.label)).toContain('GPS option (+0x80 bit 2)');
    const region = table.rows.find((r) => r.label === 'TX region code')!;
    expect(region.cells[0]!.decoded).toMatch(/0xA5: 136–174/);
    expect(table.rows.some((r) => (r.address ?? '').includes('0x10C'))).toBe(false);
    expect(fact(view, 'Factory sector')).toContain(sha256HexSync(factory));
    expect(view.hex.find((h) => h.id === 'factory')!.bytes.slice(0x10c, 0x110)).toEqual(
      Uint8Array.of(0xd1, 0xd2, 0xd3, 0xd4),
    );
  });

  it('says why the factory sector is missing', () => {
    const view = dm32CalibrationView(archive({ [BASE]: goldenPage() }));
    expect(fact(view, 'Factory sector')).toBe('Not captured');
    expect(fact(view, 'Chip UID, not a serial')).toBe('Not captured');
    const failed = archive(
      { [BASE]: goldenPage() },
      {
        sidecars: {
          'factory-sector.json': TE.encode(JSON.stringify({ kept: false, reason: 'mismatch' })),
        },
      },
    );
    expect(fact(dm32CalibrationView(failed), 'Factory sector')).toBe(
      'Not kept (two reads disagreed)',
    );
  });

  it('refuses a region whose stored length differs from the manifest and says why', () => {
    const a = archive({ [BASE]: goldenPage(), [BASE + 0x1000]: new Uint8Array(4096) });
    a.manifest = {
      ...a.manifest,
      regions: a.manifest.regions.map((r, i) => (i === 1 ? { ...r, byteLength: 8192 } : r)),
    };
    const view = dm32CalibrationView(a);
    expect(fact(view, 'Regions not used (never searched for calibration)')).toMatch(
      /do not match the manifest length/,
    );
  });
});
