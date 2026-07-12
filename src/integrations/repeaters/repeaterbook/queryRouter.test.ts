import { describe, expect, it } from 'vitest';
import { filterRepeaterBookListings } from './queryRouter.ts';
import type { RepeaterListing } from '../types.ts';

function listing(locator: string | null, location: { lat: number; lon: number } | null = null) {
  return {
    source: 'repeaterbook',
    remoteId: '1',
    callsign: 'TEST',
    name: 'Test',
    rxFrequencyHz: 146_880_000,
    txFrequencyHz: 146_280_000,
    toneHz: null,
    modes: ['fm'],
    primaryMode: 'fm',
    colourCode: null,
    locator,
    location,
    band: '2M',
    status: 'On-air',
  } satisfies RepeaterListing;
}

describe('filterRepeaterBookListings locatorPrefix', () => {
  it('filters by Maidenhead prefix', () => {
    const listings = [listing('JO22'), listing('JO33'), listing(null)];
    const filtered = filterRepeaterBookListings(listings, { locatorPrefix: 'JO22' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.locator).toBe('JO22');
  });
});
