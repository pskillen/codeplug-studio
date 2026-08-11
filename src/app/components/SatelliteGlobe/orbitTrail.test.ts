import { describe, expect, it } from 'vitest';
import { computeGlobeOrbitTrail } from './orbitTrail.ts';

const ISS_LINE_1 = '1 25544U 98067A   24045.51782528  .00016717 00000-0   30589-3 0  9993';
const ISS_LINE_2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.4956032 430001';
const ANCHOR_MS = new Date('2024-02-14T18:00:00.000Z').getTime();

describe('computeGlobeOrbitTrail', () => {
  it('samples both future and past windows with valid lat/lon/altitude', () => {
    const { futurePoints, pastPoints } = computeGlobeOrbitTrail(
      ISS_LINE_1,
      ISS_LINE_2,
      ANCHOR_MS,
      15,
      30,
      60,
    );

    expect(futurePoints.length).toBeGreaterThan(0);
    expect(pastPoints.length).toBeGreaterThan(0);

    for (const sample of [...futurePoints, ...pastPoints]) {
      expect(sample.lat).toBeGreaterThanOrEqual(-90);
      expect(sample.lat).toBeLessThanOrEqual(90);
      expect(sample.lon).toBeGreaterThanOrEqual(-180);
      expect(sample.lon).toBeLessThanOrEqual(180);
      expect(sample.altitudeKm).toBeGreaterThan(0);
    }
  });

  it('covers the requested minute windows on each side of the anchor', () => {
    const lookBehindMin = 15;
    const lookAheadMin = 30;
    const stepSec = 120;

    const { futurePoints, pastPoints } = computeGlobeOrbitTrail(
      ISS_LINE_1,
      ISS_LINE_2,
      ANCHOR_MS,
      lookBehindMin,
      lookAheadMin,
      stepSec,
    );

    const expectedFutureCount = Math.floor((lookAheadMin * 60_000) / (stepSec * 1000)) + 1;
    const expectedPastCount = Math.floor((lookBehindMin * 60_000) / (stepSec * 1000)) + 1;

    expect(futurePoints.length).toBeCloseTo(expectedFutureCount, 0);
    expect(pastPoints.length).toBeCloseTo(expectedPastCount, 0);
  });

  it('shares the anchor sample between past (last) and future (first)', () => {
    const { futurePoints, pastPoints } = computeGlobeOrbitTrail(
      ISS_LINE_1,
      ISS_LINE_2,
      ANCHOR_MS,
      15,
      30,
      30,
    );

    const pastLast = pastPoints[pastPoints.length - 1]!;
    const futureFirst = futurePoints[0]!;

    expect(pastLast.lat).toBeCloseTo(futureFirst.lat, 4);
    expect(pastLast.lon).toBeCloseTo(futureFirst.lon, 4);
    expect(pastLast.altitudeKm).toBeCloseTo(futureFirst.altitudeKm, 1);
  });

  it('omits the past side when lookBehindMin is zero but still samples future', () => {
    const { futurePoints, pastPoints } = computeGlobeOrbitTrail(
      ISS_LINE_1,
      ISS_LINE_2,
      ANCHOR_MS,
      0,
      30,
      60,
    );

    expect(pastPoints).toEqual([]);
    expect(futurePoints.length).toBeGreaterThan(1);
  });

  it('omits the future side when lookAheadMin is zero but still samples past', () => {
    const { futurePoints, pastPoints } = computeGlobeOrbitTrail(
      ISS_LINE_1,
      ISS_LINE_2,
      ANCHOR_MS,
      15,
      0,
      60,
    );

    expect(futurePoints).toEqual([]);
    expect(pastPoints.length).toBeGreaterThan(1);
  });
});
