import { describe, expect, it } from 'vitest';
import { sampleGroundTrack } from './groundTrack.ts';

const ISS_LINE_1 = '1 25544U 98067A   24045.51782528  .00016717 00000-0   30589-3 0  9993';
const ISS_LINE_2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.4956032 430001';

describe('sampleGroundTrack', () => {
  it('samples a valid lat/lon at every step across the window', () => {
    const points = sampleGroundTrack(
      ISS_LINE_1,
      ISS_LINE_2,
      '2024-02-14T18:00:00.000Z',
      '2024-02-14T18:10:00.000Z',
      60,
    );

    expect(points).toHaveLength(11);
    for (const [lat, lon] of points) {
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThanOrEqual(180);
    }
  });

  it('moves between consecutive samples — the satellite is not stationary', () => {
    const points = sampleGroundTrack(
      ISS_LINE_1,
      ISS_LINE_2,
      '2024-02-14T18:00:00.000Z',
      '2024-02-14T18:02:00.000Z',
      60,
    );

    expect(points).toHaveLength(3);
    const [a, b] = points;
    const movedDeg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    // ISS covers ~7.5 km/s ground track — a full minute must move noticeably.
    expect(movedDeg).toBeGreaterThan(0.5);
  });
});
