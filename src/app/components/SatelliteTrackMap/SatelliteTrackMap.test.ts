import { describe, expect, it } from 'vitest';
import type { LatLon } from '@core/domain/geo.ts';
import {
  buildPassTrackVisuals,
  computeApproachTrack,
  computeTrackBounds,
  type SelectedPass,
} from './SatelliteTrackMap.tsx';

const ISS_LINE_1 = '1 25544U 98067A   24045.51782528  .00016717 00000-0   30589-3 0  9993';
const ISS_LINE_2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.4956032 430001';

function issPass(overrides: Partial<SelectedPass> = {}): SelectedPass {
  return {
    satelliteName: 'ISS',
    noradId: 25544,
    tleLine1: ISS_LINE_1,
    tleLine2: ISS_LINE_2,
    aosAt: '2024-02-14T18:10:00.000Z',
    losAt: '2024-02-14T18:20:00.000Z',
    ...overrides,
  };
}

describe('computeTrackBounds', () => {
  it('returns the strict AOS/LOS window when draw-ahead/behind are both 0', () => {
    const { fromAt, toAt } = computeTrackBounds(
      '2024-02-14T18:00:00.000Z',
      '2024-02-14T18:10:00.000Z',
      0,
      0,
    );

    expect(fromAt).toBe('2024-02-14T18:00:00.000Z');
    expect(toAt).toBe('2024-02-14T18:10:00.000Z');
  });

  it('extends the start earlier by drawBehindMin, relative to aosAt', () => {
    const { fromAt, toAt } = computeTrackBounds(
      '2024-02-14T18:00:00.000Z',
      '2024-02-14T18:10:00.000Z',
      5,
      0,
    );

    expect(fromAt).toBe('2024-02-14T17:55:00.000Z');
    expect(toAt).toBe('2024-02-14T18:10:00.000Z');
  });

  it('extends the end later by drawAheadMin, relative to losAt', () => {
    const { fromAt, toAt } = computeTrackBounds(
      '2024-02-14T18:00:00.000Z',
      '2024-02-14T18:10:00.000Z',
      0,
      7,
    );

    expect(fromAt).toBe('2024-02-14T18:00:00.000Z');
    expect(toAt).toBe('2024-02-14T18:17:00.000Z');
  });

  it('extends both ends when drawBehindMin and drawAheadMin are both set', () => {
    const { fromAt, toAt } = computeTrackBounds(
      '2024-02-14T18:00:00.000Z',
      '2024-02-14T18:10:00.000Z',
      3,
      4,
    );

    expect(fromAt).toBe('2024-02-14T17:57:00.000Z');
    expect(toAt).toBe('2024-02-14T18:14:00.000Z');
  });
});

describe('computeApproachTrack', () => {
  it('samples a below-horizon track from now to aosAt when still approaching', () => {
    const points = computeApproachTrack(issPass(), '2024-02-14T18:00:00.000Z');

    expect(points.length).toBeGreaterThan(1);
    for (const [lat, lon] of points) {
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThanOrEqual(180);
    }
  });

  it('returns no points (marker-only) once now reaches aosAt', () => {
    expect(computeApproachTrack(issPass(), '2024-02-14T18:10:00.000Z')).toEqual([]);
  });

  it('returns no points (marker-only) once now is past losAt', () => {
    expect(computeApproachTrack(issPass(), '2024-02-14T18:25:00.000Z')).toEqual([]);
  });

  it('returns no points when the gap to aosAt exceeds the max approach span', () => {
    expect(computeApproachTrack(issPass(), '2024-02-14T10:00:00.000Z')).toEqual([]);
  });
});

describe('buildPassTrackVisuals', () => {
  const mainPoints: LatLon[] = [
    [10, 20],
    [11, 22],
    [12, 24],
  ];

  it('returns empty visuals when there is no main track', () => {
    expect(buildPassTrackVisuals([], [], null, 0)).toEqual({
      mainPoints: [],
      approachPoints: [],
      markerPoint: null,
    });
  });

  it('shifts the main track near the reference longitude when no live position exists', () => {
    // Raw main track sits near lon 20; observer (reference) is on the far side of the world.
    const visuals = buildPassTrackVisuals(mainPoints, [], null, 200);

    expect(visuals.mainPoints).toEqual([
      [10, 380],
      [11, 382],
      [12, 384],
    ]);
    expect(visuals.approachPoints).toEqual([]);
    expect(visuals.markerPoint).toBeNull();
  });

  it('joins the approach track continuously onto the main track, with the marker as its first point', () => {
    const approachPoints: LatLon[] = [
      [8, 15],
      [9, 18],
    ];
    // Reference near the main track's own raw longitude — shift should be 0.
    const visuals = buildPassTrackVisuals(mainPoints, approachPoints, [8, 15], 20);

    expect(visuals.mainPoints).toEqual(mainPoints);
    expect(visuals.approachPoints).toEqual(approachPoints);
    expect(visuals.markerPoint).toEqual(approachPoints[0]);

    // Continuity: no jump greater than the largest real gap already present in the raw data.
    const combined = [...visuals.approachPoints, ...visuals.mainPoints];
    for (let i = 1; i < combined.length; i += 1) {
      expect(Math.abs(combined[i]![1] - combined[i - 1]![1])).toBeLessThan(10);
    }
  });

  it("places a marker-only live position using the main track's own shift when there is no approach track", () => {
    const visuals = buildPassTrackVisuals(mainPoints, [], [9, 19], 200);

    expect(visuals.approachPoints).toEqual([]);
    // Same shift (+360) as the main-track-only case above, applied to the live point too.
    expect(visuals.markerPoint).toEqual([9, 379]);
  });

  it('keeps a continuous shifted sequence across an antimeridian crossing near the reference', () => {
    // Approach approaches AOS from just east of the antimeridian; main track starts just west of
    // it — a real crossing between the two, not just a raw-value artifact.
    const crossingMain: LatLon[] = [
      [0, -179],
      [0, -178],
    ];
    const crossingApproach: LatLon[] = [
      [0, 175],
      [0, 179],
    ];
    // Observer sits right at the antimeridian.
    const visuals = buildPassTrackVisuals(crossingMain, crossingApproach, [0, 175], 180);

    const combined = [...visuals.approachPoints, ...visuals.mainPoints];
    for (let i = 1; i < combined.length; i += 1) {
      expect(Math.abs(combined[i]![1] - combined[i - 1]![1])).toBeLessThanOrEqual(4);
    }
    expect(visuals.markerPoint).toEqual(visuals.approachPoints[0]);
  });
});
