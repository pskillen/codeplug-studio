import { describe, expect, it } from 'vitest';
import type { RayPathResult } from '@core/domain/hfPropagation/types.ts';
import { rayGroundTrack } from './mapGeometry.ts';

function ray(
  overrides: Partial<RayPathResult> & Pick<RayPathResult, 'points'>,
): RayPathResult {
  return {
    mode: 'skywave',
    takeoffAngleDeg: 20,
    relativeSignalStrength: 0.9,
    ...overrides,
  };
}

describe('rayGroundTrack', () => {
  it('returns an empty track when there are no rays', () => {
    expect(rayGroundTrack([])).toEqual([]);
  });

  it('maps the first ray lat/lon and drops altitude', () => {
    const track = rayGroundTrack([
      ray({
        points: [
          { lat: 51.5, lon: -0.13, altitudeKm: 0 },
          { lat: 52, lon: 1, altitudeKm: 250 },
          { lat: 53, lon: 2, altitudeKm: 0 },
        ],
      }),
      ray({
        mode: 'nvis',
        points: [
          { lat: 0, lon: 0, altitudeKm: 0 },
          { lat: 1, lon: 1, altitudeKm: 0 },
        ],
      }),
    ]);

    expect(track).toEqual([
      [51.5, -0.13],
      [52, 1],
      [53, 2],
    ]);
  });
});
