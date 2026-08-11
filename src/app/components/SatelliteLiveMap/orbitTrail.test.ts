import { describe, expect, it } from 'vitest';
import { computeOrbitTrailSegments } from './orbitTrail.ts';

const ISS_LINE_1 = '1 25544U 98067A   24045.51782528  .00016717 00000-0   30589-3 0  9993';
const ISS_LINE_2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.4956032 430001';
const ISS_MEAN_MOTION_REV_PER_DAY = 15.4956032;
const ANCHOR_MS = new Date('2024-02-14T18:00:00.000Z').getTime();

describe('computeOrbitTrailSegments', () => {
  it('samples both a future and a past window, each with valid lat/lon', () => {
    const { futureSegments, pastSegments } = computeOrbitTrailSegments(
      ISS_LINE_1,
      ISS_LINE_2,
      ISS_MEAN_MOTION_REV_PER_DAY,
      ANCHOR_MS,
      60,
    );

    expect(futureSegments.length).toBeGreaterThan(0);
    expect(pastSegments.length).toBeGreaterThan(0);

    for (const segment of [...futureSegments, ...pastSegments]) {
      for (const [lat, lon] of segment) {
        expect(lat).toBeGreaterThanOrEqual(-90);
        expect(lat).toBeLessThanOrEqual(90);
        expect(lon).toBeGreaterThanOrEqual(-180);
        expect(lon).toBeLessThanOrEqual(180);
      }
    }
  });

  it('covers roughly 1.5 orbital periods on each side of the anchor', () => {
    // ISS period ~= 1440 / 15.4956032 ~= 92.9 minutes; 1.5 periods ~= 139.4 minutes.
    const periodMinutes = 1440 / ISS_MEAN_MOTION_REV_PER_DAY;
    const orbitTrailMultiple = 1.5;
    const expectedWindowMs = orbitTrailMultiple * periodMinutes * 60_000;

    const stepSec = 120;
    const { futureSegments, pastSegments } = computeOrbitTrailSegments(
      ISS_LINE_1,
      ISS_LINE_2,
      ISS_MEAN_MOTION_REV_PER_DAY,
      ANCHOR_MS,
      stepSec,
      orbitTrailMultiple,
    );

    const futureSampleCount = futureSegments.reduce((sum, segment) => sum + segment.length, 0);
    const pastSampleCount = pastSegments.reduce((sum, segment) => sum + segment.length, 0);
    const expectedSampleCount = Math.floor(expectedWindowMs / (stepSec * 1000)) + 1;

    // Splitting at the antimeridian never drops samples, only regroups them — total sample
    // count across all segments should match an unsplit sweep over the same window.
    expect(futureSampleCount).toBeCloseTo(expectedSampleCount, 0);
    expect(pastSampleCount).toBeCloseTo(expectedSampleCount, 0);
  });

  it('scales the window with orbitTrailMultiple', () => {
    const periodMinutes = 1440 / ISS_MEAN_MOTION_REV_PER_DAY;
    const stepSec = 120;
    const shortMultiple = 0.5;
    const longMultiple = 2;

    const short = computeOrbitTrailSegments(
      ISS_LINE_1,
      ISS_LINE_2,
      ISS_MEAN_MOTION_REV_PER_DAY,
      ANCHOR_MS,
      stepSec,
      shortMultiple,
    );
    const long = computeOrbitTrailSegments(
      ISS_LINE_1,
      ISS_LINE_2,
      ISS_MEAN_MOTION_REV_PER_DAY,
      ANCHOR_MS,
      stepSec,
      longMultiple,
    );

    const shortFutureCount = short.futureSegments.reduce((sum, segment) => sum + segment.length, 0);
    const longFutureCount = long.futureSegments.reduce((sum, segment) => sum + segment.length, 0);

    expect(longFutureCount).toBeGreaterThan(shortFutureCount);
    expect(shortFutureCount).toBeCloseTo(
      Math.floor((shortMultiple * periodMinutes * 60_000) / (stepSec * 1000)) + 1,
      0,
    );
  });

  it('splits future and past ground tracks independently at the antimeridian', () => {
    // A near-polar, fast-crossing orbit whose ground track sweeps through +/-180 lon
    // multiple times within a 1.5-orbit window on both sides of the anchor.
    const { futureSegments, pastSegments } = computeOrbitTrailSegments(
      ISS_LINE_1,
      ISS_LINE_2,
      ISS_MEAN_MOTION_REV_PER_DAY,
      ANCHOR_MS,
      30,
    );

    // Every segment boundary within each list must actually be an antimeridian crossing —
    // i.e. segments were not merged across the anchor between the past and future sweeps.
    for (const segments of [futureSegments, pastSegments]) {
      for (let i = 1; i < segments.length; i += 1) {
        const prevSegment = segments[i - 1]!;
        const nextSegment = segments[i]!;
        const prevLon = prevSegment[prevSegment.length - 1]![1];
        const nextLon = nextSegment[0]![1];
        expect(Math.abs(nextLon - prevLon)).toBeGreaterThan(180);
      }
    }
  });
});
