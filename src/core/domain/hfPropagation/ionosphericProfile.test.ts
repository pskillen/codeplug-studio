import { describe, expect, it } from 'vitest';
import { computeIonosphericLayers } from './ionosphericProfile.ts';

const EQUINOX_SOLAR_NOON_UTC = Date.UTC(2024, 2, 20, 12, 0, 0);
const EQUINOX_MIDNIGHT_UTC = Date.UTC(2024, 2, 20, 0, 0, 0);

function layersById(
  atMs: number,
  preset: 'quiet' | 'moderate' | 'solar-max' | 'storm' = 'moderate',
) {
  const layers = computeIonosphericLayers(0, 0, atMs, preset);
  return Object.fromEntries(layers.map((layer) => [layer.id, layer]));
}

describe('computeIonosphericLayers', () => {
  it('activates D and F1 during daytime and deactivates them at night', () => {
    const day = layersById(EQUINOX_SOLAR_NOON_UTC);
    const night = layersById(EQUINOX_MIDNIGHT_UTC);

    expect(day.D?.active).toBe(true);
    expect(day.F1?.active).toBe(true);
    expect(night.D?.active).toBe(false);
    expect(night.F1?.active).toBe(false);
    expect(night.D?.peakElectronDensity).toBe(0);
    expect(night.F1?.peakElectronDensity).toBe(0);
  });

  it('keeps E and F2 active at night with reduced density', () => {
    const day = layersById(EQUINOX_SOLAR_NOON_UTC);
    const night = layersById(EQUINOX_MIDNIGHT_UTC);

    expect(day.E?.active).toBe(true);
    expect(day.F2?.active).toBe(true);
    expect(night.E?.active).toBe(true);
    expect(night.F2?.active).toBe(true);
    expect(night.F2?.peakElectronDensity).toBeCloseTo((day.F2?.peakElectronDensity ?? 0) * 0.3);
    expect(night.E?.peakElectronDensity).toBeCloseTo((day.E?.peakElectronDensity ?? 0) * 0.3);
  });

  it('uses the reference altitude bands', () => {
    const day = layersById(EQUINOX_SOLAR_NOON_UTC);
    expect(day.D).toMatchObject({ altitudeMinKm: 60, altitudeMaxKm: 90 });
    expect(day.E).toMatchObject({ altitudeMinKm: 90, altitudeMaxKm: 150 });
    expect(day.F1).toMatchObject({ altitudeMinKm: 150, altitudeMaxKm: 250 });
    expect(day.F2).toMatchObject({ altitudeMinKm: 250, altitudeMaxKm: 400 });
  });

  it('drops F2 altitudeMinKm to 150 km at night so the F-region fills the F1 band', () => {
    const day = layersById(EQUINOX_SOLAR_NOON_UTC);
    const night = layersById(EQUINOX_MIDNIGHT_UTC);
    expect(day.F2?.altitudeMinKm).toBe(250);
    expect(day.F2?.altitudeMaxKm).toBe(400);
    expect(night.F2?.altitudeMinKm).toBe(150);
    expect(night.F2?.altitudeMaxKm).toBe(400);
  });

  it('scales daytime F2 density with the solar-activity preset', () => {
    const quiet = layersById(EQUINOX_SOLAR_NOON_UTC, 'quiet').F2?.peakElectronDensity ?? 0;
    const moderate = layersById(EQUINOX_SOLAR_NOON_UTC, 'moderate').F2?.peakElectronDensity ?? 0;
    const solarMax = layersById(EQUINOX_SOLAR_NOON_UTC, 'solar-max').F2?.peakElectronDensity ?? 0;
    const storm = layersById(EQUINOX_SOLAR_NOON_UTC, 'storm').F2?.peakElectronDensity ?? 0;

    expect(quiet).toBeLessThan(moderate);
    expect(moderate).toBeLessThan(solarMax);
    expect(storm).toBeLessThan(moderate);
    expect(storm).toBeGreaterThan(quiet);
  });
});
