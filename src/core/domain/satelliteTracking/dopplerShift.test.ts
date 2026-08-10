import { describe, expect, it } from 'vitest';
import {
  degreesToRadians,
  ecfToLookAngles,
  eciToEcf,
  gstime,
  propagate,
  twoline2satrec,
} from 'satellite.js';
import { computeDopplerFactor } from './dopplerShift.ts';
import type { ObserverLocation } from './types.ts';

const ISS_LINE_1 = '1 25544U 98067A   24045.51782528  .00016717 00000-0   30589-3 0  9993';
const ISS_LINE_2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.4956032 430001';

// Speed of light, km/s — matches satellite.js's own `dopplerFactor` constant.
const SPEED_OF_LIGHT_KM_S = 299_792.458;
// ISS orbital velocity is ~7.66 km/s; no LEO ground-station geometry can produce a radial
// velocity component larger than the satellite's own orbital speed.
const ISS_MAX_RADIAL_VELOCITY_KM_S = 7.8;

const OBSERVER: ObserverLocation = { latDeg: 51.5, lonDeg: -0.1, heightKm: 0 };
const AT = '2024-02-14T18:00:00.000Z';

/** Range from observer to satellite (km) via the same chain `passPrediction.ts` already uses. */
function rangeKmAt(tleLine1: string, tleLine2: string, observer: ObserverLocation, at: string) {
  const satrec = twoline2satrec(tleLine1, tleLine2);
  const date = new Date(at);
  const positionAndVelocity = propagate(satrec, date);
  if (!positionAndVelocity?.position) throw new Error('propagation failed');
  const gmst = gstime(date);
  const positionEcf = eciToEcf(positionAndVelocity.position, gmst);
  const observerGeodetic = {
    longitude: degreesToRadians(observer.lonDeg),
    latitude: degreesToRadians(observer.latDeg),
    height: observer.heightKm ?? 0,
  };
  return ecfToLookAngles(observerGeodetic, positionEcf).rangeSat;
}

describe('computeDopplerFactor', () => {
  it('stays within the physically possible bound for a LEO pass', () => {
    const factor = computeDopplerFactor(ISS_LINE_1, ISS_LINE_2, OBSERVER, AT);
    expect(factor).not.toBeNull();
    // |1 - rangeRate/c| bounded by the satellite's own max orbital speed / c.
    expect(Math.abs(factor! - 1)).toBeLessThan(ISS_MAX_RADIAL_VELOCITY_KM_S / SPEED_OF_LIGHT_KM_S);
  });

  it('matches an independent finite-difference range-rate estimate', () => {
    const factor = computeDopplerFactor(ISS_LINE_1, ISS_LINE_2, OBSERVER, AT);
    expect(factor).not.toBeNull();

    const dtSec = 1;
    const rangeAtT = rangeKmAt(ISS_LINE_1, ISS_LINE_2, OBSERVER, AT);
    const rangeAtTPlusDt = rangeKmAt(
      ISS_LINE_1,
      ISS_LINE_2,
      OBSERVER,
      new Date(new Date(AT).getTime() + dtSec * 1000).toISOString(),
    );
    const finiteDiffRangeRateKmS = (rangeAtTPlusDt - rangeAtT) / dtSec;
    const factorRangeRateKmS = (1 - factor!) * SPEED_OF_LIGHT_KM_S;

    // Finite-difference error over 1s is small relative to LEO range-rate magnitudes (orbital
    // acceleration ~0.009 km/s^2), so a generous 0.1 km/s tolerance comfortably separates a
    // correct implementation from a sign or scale error.
    expect(factorRangeRateKmS).toBeCloseTo(finiteDiffRangeRateKmS, 1);
  });

  it('reports factor > 1 when approaching and < 1 when receding, matching dopplerFactor’s convention', () => {
    // Sweep forward in 30s steps across roughly one full ISS orbit (~92 minutes) so the
    // observer's range to the satellite is guaranteed to both increase and decrease at least
    // once, regardless of whether a pass happens to start right at `AT` — real orbital
    // geometry, not synthetic data.
    const stepSec = 30;
    const samples: { at: string; rangeKm: number }[] = [];
    for (let i = 0; i < 200; i += 1) {
      const at = new Date(new Date(AT).getTime() + i * stepSec * 1000).toISOString();
      samples.push({ at, rangeKm: rangeKmAt(ISS_LINE_1, ISS_LINE_2, OBSERVER, at) });
    }

    let approachingAt: string | null = null;
    let recedingAt: string | null = null;
    for (let i = 1; i < samples.length; i += 1) {
      const delta = samples[i]!.rangeKm - samples[i - 1]!.rangeKm;
      if (delta < 0 && !approachingAt) approachingAt = samples[i]!.at;
      if (delta > 0 && !recedingAt) recedingAt = samples[i]!.at;
    }
    expect(approachingAt).not.toBeNull();
    expect(recedingAt).not.toBeNull();

    const approachingFactor = computeDopplerFactor(
      ISS_LINE_1,
      ISS_LINE_2,
      OBSERVER,
      approachingAt!,
    );
    const recedingFactor = computeDopplerFactor(ISS_LINE_1, ISS_LINE_2, OBSERVER, recedingAt!);
    expect(approachingFactor!).toBeGreaterThan(1);
    expect(recedingFactor!).toBeLessThan(1);
  });

  it('returns null when propagation fails (malformed TLE)', () => {
    const factor = computeDopplerFactor('not', 'a valid tle', OBSERVER, AT);
    expect(factor).toBeNull();
  });
});
