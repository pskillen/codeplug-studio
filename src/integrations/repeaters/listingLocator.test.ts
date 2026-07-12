import { describe, expect, it } from 'vitest';
import { listingDisplayLocator, listingMatchesLocatorPrefix } from './listingLocator.ts';
import type { RepeaterListing } from './types.ts';

function sampleListing(overrides: Partial<RepeaterListing> = {}): RepeaterListing {
  return {
    source: 'repeaterbook',
    remoteId: '1',
    callsign: 'W6TEST',
    name: 'Test',
    rxFrequencyHz: 146_880_000,
    txFrequencyHz: 146_280_000,
    toneHz: null,
    modes: ['fm'],
    primaryMode: 'fm',
    colourCode: null,
    locator: null,
    location: null,
    band: '2M',
    status: 'On-air',
    ...overrides,
  };
}

describe('listingDisplayLocator', () => {
  it('returns wire locator when present', () => {
    expect(listingDisplayLocator(sampleListing({ locator: 'io92' }))).toBe('IO92');
  });

  it('derives 4-char locator from coordinates', () => {
    const listing = sampleListing({
      location: { lat: 51.5, lon: -0.1 },
    });
    expect(listingDisplayLocator(listing)).toMatch(/^[A-R]{2}[0-9]{2}$/);
  });

  it('returns null when no locator or coordinates', () => {
    expect(listingDisplayLocator(sampleListing())).toBeNull();
  });
});

describe('listingMatchesLocatorPrefix', () => {
  it('matches locator prefix case-insensitively', () => {
    const listing = sampleListing({ locator: 'JO22' });
    expect(listingMatchesLocatorPrefix(listing, 'jo')).toBe(true);
    expect(listingMatchesLocatorPrefix(listing, 'JO33')).toBe(false);
  });
});
