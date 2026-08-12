import { describe, expect, it } from 'vitest';
import {
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
    const segments = computeApproachTrack(issPass(), '2024-02-14T18:00:00.000Z');

    expect(segments.length).toBeGreaterThan(0);
    const allPoints = segments.flat();
    expect(allPoints.length).toBeGreaterThan(1);
    for (const [lat, lon] of allPoints) {
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThanOrEqual(180);
    }
  });

  it('returns no segments (marker-only) once now reaches aosAt', () => {
    const segments = computeApproachTrack(issPass(), '2024-02-14T18:10:00.000Z');
    expect(segments).toEqual([]);
  });

  it('returns no segments (marker-only) once now is past losAt', () => {
    const segments = computeApproachTrack(issPass(), '2024-02-14T18:25:00.000Z');
    expect(segments).toEqual([]);
  });

  it('returns no segments when the gap to aosAt exceeds the max approach span', () => {
    const segments = computeApproachTrack(issPass(), '2024-02-14T10:00:00.000Z');
    expect(segments).toEqual([]);
  });
});
