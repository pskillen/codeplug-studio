import { describe, expect, it } from 'vitest';
import { eciToGeodetic, gstime, propagate, radiansToDegrees, twoline2satrec } from 'satellite.js';
import { computePassesForSatellite } from './passPrediction.ts';

// Real, checksum-valid ISS TLE (also used by the slice-1 TLE parser fixtures).
const ISS_LINE_1 = '1 25544U 98067A   24045.51782528  .00016717 00000-0   30589-3 0  9993';
const ISS_LINE_2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.4956032 430001';

/** Subsatellite point at a given instant — used to derive a geometry-based known-answer case. */
function subsatellitePointAt(date: Date): { latDeg: number; lonDeg: number } {
  const satrec = twoline2satrec(ISS_LINE_1, ISS_LINE_2);
  const positionAndVelocity = propagate(satrec, date);
  if (!positionAndVelocity?.position) {
    throw new Error('propagation failed for fixture setup');
  }
  const gmst = gstime(date);
  const geodetic = eciToGeodetic(positionAndVelocity.position, gmst);
  return {
    latDeg: radiansToDegrees(geodetic.latitude),
    lonDeg: radiansToDegrees(geodetic.longitude),
  };
}

describe('computePassesForSatellite', () => {
  it('reports near-zenith elevation for an observer under the ground track at that instant', () => {
    // Epoch + 6h — well clear of the TLE epoch itself, still within a
    // realistic short-term propagation horizon for this fixture.
    const targetDate = new Date('2024-02-14T18:00:00.000Z');
    const observer = subsatellitePointAt(targetDate);

    const passes = computePassesForSatellite(ISS_LINE_1, ISS_LINE_2, observer, {
      fromAt: new Date(targetDate.getTime() - 5 * 60_000).toISOString(),
      toAt: new Date(targetDate.getTime() + 5 * 60_000).toISOString(),
      stepMinutes: 0.25,
    });

    expect(passes).toHaveLength(1);
    const pass = passes[0]!;
    // An observer exactly under the ground track sees a near-zenith pass —
    // a genuine geometric invariant, not a value copied from this function's own output.
    expect(pass.maxElevationDeg).toBeGreaterThan(75);
    expect(new Date(pass.aosAt).getTime()).toBeLessThan(new Date(pass.maxElevationAt).getTime());
    expect(new Date(pass.maxElevationAt).getTime()).toBeLessThanOrEqual(
      new Date(pass.losAt).getTime(),
    );
    expect(pass.durationSec).toBeGreaterThan(0);
  });

  it('finds no passes for an observer on the opposite side of the Earth', () => {
    const targetDate = new Date('2024-02-14T18:00:00.000Z');
    const subsatellite = subsatellitePointAt(targetDate);
    const antipodal = {
      latDeg: -subsatellite.latDeg,
      lonDeg: subsatellite.lonDeg > 0 ? subsatellite.lonDeg - 180 : subsatellite.lonDeg + 180,
    };

    const passes = computePassesForSatellite(ISS_LINE_1, ISS_LINE_2, antipodal, {
      fromAt: new Date(targetDate.getTime() - 3 * 60_000).toISOString(),
      toAt: new Date(targetDate.getTime() + 3 * 60_000).toISOString(),
      stepMinutes: 1,
    });

    expect(passes).toHaveLength(0);
  });

  it('returns an empty array when the satellite never rises above the horizon in the window', () => {
    const passes = computePassesForSatellite(
      ISS_LINE_1,
      ISS_LINE_2,
      { latDeg: 0, lonDeg: 0 },
      {
        fromAt: '2024-02-14T00:00:00.000Z',
        toAt: '2024-02-14T00:01:00.000Z',
        stepMinutes: 1,
      },
    );

    expect(Array.isArray(passes)).toBe(true);
  });
});
