import { describe, expect, it } from 'vitest';
import { normaliseOpenAipAirport } from './openaipClient.ts';
import { openAipFrequencyTypeLabel, parseOpenAipFrequencyMhz } from './openaip/frequencyTypes.ts';

describe('parseOpenAipFrequencyMhz', () => {
  it('converts MHz string to Hz', () => {
    expect(parseOpenAipFrequencyMhz('119.100')).toBe(119_100_000);
    expect(parseOpenAipFrequencyMhz('118.805')).toBe(118_805_000);
  });

  it('returns null for invalid values', () => {
    expect(parseOpenAipFrequencyMhz('')).toBeNull();
    expect(parseOpenAipFrequencyMhz('abc')).toBeNull();
  });
});

describe('openAipFrequencyTypeLabel', () => {
  it('maps known type codes', () => {
    expect(openAipFrequencyTypeLabel(14)).toBe('Tower');
    expect(openAipFrequencyTypeLabel(15)).toBe('ATIS');
    expect(openAipFrequencyTypeLabel(0)).toBe('Approach');
  });

  it('prefers wire name when present', () => {
    expect(openAipFrequencyTypeLabel(17, 'GLA Tower')).toBe('GLA Tower');
  });
});

describe('normaliseOpenAipAirport', () => {
  it('maps wire airport to listing', () => {
    const listing = normaliseOpenAipAirport({
      _id: 'abc123',
      name: 'Glasgow',
      icaoCode: 'EGPF',
      iataCode: 'GLA',
      elevation: { value: 8 },
      geometry: { type: 'Point', coordinates: [-4.433, 55.8719] },
      frequencies: [
        { value: '119.100', type: 14, primary: true },
        { value: '129.575', type: 15, primary: false, name: 'ATIS' },
      ],
    });

    expect(listing.icao).toBe('EGPF');
    expect(listing.iata).toBe('GLA');
    expect(listing.location).toEqual({ lat: 55.8719, lon: -4.433 });
    expect(listing.frequencies).toHaveLength(2);
    expect(listing.frequencies[0]).toMatchObject({
      service: 'Tower',
      rxFrequencyHz: 119_100_000,
    });
    expect(listing.frequencies[1]?.service).toBe('ATIS');
  });
});
