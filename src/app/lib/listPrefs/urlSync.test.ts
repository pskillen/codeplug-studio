import { describe, expect, it } from 'vitest';
import {
  hasNearbyFilterUrlParams,
  nearbyPrefsFromSearchParams,
  nearbyPrefsToSearchParams,
} from './urlSync.ts';

describe('nearby prefs url sync', () => {
  it('round-trips prefs', () => {
    const prefs = {
      radiusKm: 40.23,
      sources: ['ukrepeater', 'meshtastic'],
      bands: ['2m'],
      modes: ['dmr'],
      operationalOnly: true,
    };
    const params = nearbyPrefsToSearchParams(prefs);
    expect(params.get('s')).toBe('ukrepeater,meshtastic');
    expect(nearbyPrefsFromSearchParams(params)).toEqual(prefs);
  });

  it('maps an empty source list to s=none and back', () => {
    const params = nearbyPrefsToSearchParams({ sources: [] });
    expect(params.get('s')).toBe('none');
    expect(nearbyPrefsFromSearchParams(params)).toEqual({ sources: [] });
  });

  it('omits s when sources are undefined', () => {
    const params = nearbyPrefsToSearchParams({ radiusKm: 10 });
    expect(params.has('s')).toBe(false);
    expect(nearbyPrefsFromSearchParams(params)).toEqual({ radiusKm: 10 });
  });

  it('ignores the search point when detecting filter params', () => {
    expect(hasNearbyFilterUrlParams(new URLSearchParams('lat=1&lon=2&pl=x'))).toBe(false);
    expect(hasNearbyFilterUrlParams(new URLSearchParams('lat=1&lon=2&b=2m'))).toBe(true);
  });
});
