import { describe, expect, it } from 'vitest';
import { normaliseRepeaterBookCountry, repeaterBookRegionForCountry } from './countryNames.ts';

describe('normaliseRepeaterBookCountry', () => {
  it('maps geocoder aliases to RepeaterBook names', () => {
    expect(
      normaliseRepeaterBookCountry('United Kingdom of Great Britain and Northern Ireland'),
    ).toBe('United Kingdom');
    expect(normaliseRepeaterBookCountry('United States of America')).toBe('United States');
    expect(normaliseRepeaterBookCountry('GB')).toBe('United Kingdom');
  });

  it('returns canonical list names case-insensitively', () => {
    expect(normaliseRepeaterBookCountry('united kingdom')).toBe('United Kingdom');
    expect(normaliseRepeaterBookCountry('Switzerland')).toBe('Switzerland');
  });
});

describe('repeaterBookRegionForCountry', () => {
  it('routes North American countries to na export', () => {
    expect(repeaterBookRegionForCountry('United States')).toBe('na');
    expect(repeaterBookRegionForCountry('Canada')).toBe('na');
  });

  it('routes other countries to row export', () => {
    expect(repeaterBookRegionForCountry('United Kingdom')).toBe('row');
    expect(repeaterBookRegionForCountry('Switzerland')).toBe('row');
  });
});
