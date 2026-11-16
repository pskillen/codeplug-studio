import { describe, expect, it } from 'vitest';
import { OPENGD77_CALIBRATION_LENGTH } from '@core/radios/opengd77/calibration.ts';
import { syntheticOpenGd77Archive, syntheticOpenGd77Calibration } from './opengd77.fixture.ts';
import { openGd77CalibrationView } from '@integrations/radio-io/radios/opengd77/debugCalibrationView.ts';
import {
  OPENGD77_DM1701_MODEL_ID,
  OPENGD77_MD9600_MODEL_ID,
} from '@integrations/radio-io/radios/opengd77/hydration.ts';

describe.each([
  ['DM-1701', OPENGD77_DM1701_MODEL_ID, 'Very-low (250 mW)', true, [135, 145, 155, 165, 175]],
  ['MD-9600', OPENGD77_MD9600_MODEL_ID, 'Mid-low (10 W)', false, [136, 145.5, 155, 164.5, 174]],
])('openGd77CalibrationView on %s', (_name, modelId, slot, scaled, vhfPowerMhz) => {
  it('charts power, RX tuning, squelch and oscillator trim per band with stable ids', async () => {
    const view = openGd77CalibrationView(await syntheticOpenGd77Archive(modelId));
    expect(view.status.kind).toBe('ok');
    expect(view.charts.map((c) => c.id)).toEqual([
      'power-uhf',
      'rx-tuning-uhf',
      'squelch-uhf',
      'trim-uhf',
      'power-vhf',
      'rx-tuning-vhf',
      'squelch-vhf',
      'trim-vhf',
    ]);
    const uhf = view.charts[0]!;
    const vhf = view.charts[4]!;
    if (uhf.kind !== 'frequency-curve' || vhf.kind !== 'frequency-curve') throw new Error('kind');
    expect(uhf.series.map((s) => s.id)).toEqual([
      'high-power',
      'mid-power',
      'low-power',
      'low-slot-power',
    ]);
    expect(uhf.series[3]!.label).toBe(slot);
    expect(uhf.series[0]!.points).toHaveLength(9);
    expect(vhf.series[0]!.points).toHaveLength(5);
    // Power and RX tuning draw in MHz on the firmware's own grids, not a point index.
    expect(uhf.x).toEqual({ label: 'Frequency', unit: 'MHz' });
    expect(uhf.series[0]!.points.map((p) => p.x)).toEqual([
      400, 410, 420, 430, 440, 450, 460, 470, 480,
    ]);
    expect(vhf.series[0]!.points.map((p) => p.x)).toEqual(vhfPowerMhz);
    expect(uhf.about).toMatch(/not the inferred stock frequency-point table/);
    expect(uhf.table.key.label).toBe('Point · MHz');
    expect(uhf.table.rows).toHaveLength(9);
    expect(uhf.table.rows[0]!.key).toBe('0 · 400 MHz');
    const vhfTuning = view.charts[5]!;
    if (vhfTuning.kind !== 'frequency-curve') throw new Error('kind');
    expect(vhfTuning.series[0]!.points.map((p) => p.x)).toEqual([136, 145.5, 155, 164.5, 174]);
    // Squelch keeps the point index: no consumer, no stated grid.
    const squelch = view.charts[2]!;
    if (squelch.kind !== 'frequency-curve') throw new Error('kind');
    expect(squelch.x.unit).toBeUndefined();
    expect(squelch.about).toMatch(/point index \(0 first\), not MHz/);
    expect(squelch.series.map((s) => s.label)).toEqual([
      'Open, level 9',
      'Close, level 9',
      'Open, level 1',
      'Close, level 1',
    ]);
  });

  it('puts the provenance caveats in notice lines; the scaled line is DM-1701 only', async () => {
    const view = openGd77CalibrationView(await syntheticOpenGd77Archive(modelId));
    const text = view.notice!.lines.join(' ');
    expect(view.notice!.title).toBe('Not validated on hardware');
    expect(text).toMatch(/not stock factory calibration/);
    expect(/scaled from the factory values/.test(text)).toBe(scaled);
    expect(view.facts!.find((f) => f.label === 'Local marker')!.value).toMatch(/Present at 0x1B0/);
    expect(view.facts!.find((f) => f.label === 'Layout basis')!.value).toMatch(/2026-01-30/);
  });

  it('supplies band-layout tables, unused ranges and the full raw bytes', async () => {
    const view = openGd77CalibrationView(await syntheticOpenGd77Archive(modelId));
    expect(view.tables.map((t) => t.id)).toEqual([
      'reference',
      'ctcss',
      'dcs',
      'gains',
      'frequency-points',
    ]);
    const gains = view.tables.find((t) => t.id === 'gains')!;
    expect(gains.layout).toEqual({ bands: ['UHF', 'VHF'] });
    expect(gains.rows).toHaveLength(4);
    expect(gains.rows[0]!.cells[0]!.raw).toHaveLength(9);
    expect(gains.rows[0]!.cells[1]!.raw).toHaveLength(5);
    expect(view.unused!.length).toBeGreaterThan(0);
    expect(view.unused![0]!.why).toMatch(/not used by OpenGD77/);
    expect(view.hex[0]!.bytes).toHaveLength(OPENGD77_CALIBRATION_LENGTH);
    expect(view.hex[0]!.address).toBe(0x10000);
  });

  it('shows raw only, with no charts, when the marker is absent', async () => {
    const view = openGd77CalibrationView(
      await syntheticOpenGd77Archive(modelId, {
        calibration: syntheticOpenGd77Calibration(0, false),
      }),
    );
    expect(view.status.kind).toBe('ok');
    expect(view.charts).toHaveLength(0);
    expect(view.facts!.find((f) => f.label === 'Local marker')!.value).toMatch(/^Absent/);
    expect(view.tables[0]!.rows[0]!.cells[0]!.decoded).toBeUndefined();
    expect(view.tables[0]!.rows[0]!.cells[0]!.raw).toBeDefined();
  });

  it('says not-captured without the region and refused without FirmwareInfo', async () => {
    const none = openGd77CalibrationView(
      await syntheticOpenGd77Archive(modelId, { calibration: null }),
    );
    expect(none.status.kind).toBe('not-captured');
    const base = await syntheticOpenGd77Archive(modelId);
    const refused = openGd77CalibrationView({ ...base, sidecars: {} });
    expect(refused.status.kind).toBe('refused');
    expect((refused.status as { reason: string }).reason).toMatch(/no FirmwareInfo/);
  });

  it('keeps chart ids stable across two reads so the overlay pairs them', async () => {
    const changed = syntheticOpenGd77Calibration(0);
    changed[0x10] = (changed[0x10]! + 1) % 10;
    const a = openGd77CalibrationView(await syntheticOpenGd77Archive(modelId));
    const b = openGd77CalibrationView(
      await syntheticOpenGd77Archive(modelId, { calibration: changed }),
    );
    expect(b.charts.map((c) => c.id)).toEqual(a.charts.map((c) => c.id));
    const pa = a.charts[0]!;
    const pb = b.charts[0]!;
    if (pa.kind !== 'frequency-curve' || pb.kind !== 'frequency-curve') throw new Error('kind');
    expect(pa.series[0]!.points[0]!.y).not.toBe(pb.series[0]!.points[0]!.y);
    expect(pa.series[0]!.points[1]).toEqual(pb.series[0]!.points[1]);
  });
});
