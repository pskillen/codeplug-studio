import { describe, expect, it } from 'vitest';
import { parseZonePivotSearch, zonePivotPath } from './zonePivotQuery.ts';

describe('zonePivotQuery', () => {
  it('defaults to all channels', () => {
    expect(parseZonePivotSearch('')).toEqual({ pivot: 'all', zoneId: null });
    expect(zonePivotPath({ pivot: 'all', zoneId: null })).toBe('/library/zones?pivot=all');
  });

  it('parses orphans and zone pivots', () => {
    expect(parseZonePivotSearch('?pivot=orphans')).toEqual({ pivot: 'orphans', zoneId: null });
    expect(parseZonePivotSearch('?pivot=zone&zoneId=z-1')).toEqual({
      pivot: 'zone',
      zoneId: 'z-1',
    });
  });
});
