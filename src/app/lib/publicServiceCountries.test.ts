import { describe, expect, it } from 'vitest';
import { availableCountries, countryCodeFromLocale } from './publicServiceCountries.ts';

describe('countryCodeFromLocale', () => {
  it('selects GB from en-GB', () => {
    expect(countryCodeFromLocale('en-GB')).toBe('GB');
  });

  it('does not silently choose GB for en-US', () => {
    expect(countryCodeFromLocale('en-US')).toBeNull();
  });

  it('returns null when the locale has no region', () => {
    expect(countryCodeFromLocale('en')).toBeNull();
  });
});

describe('availableCountries', () => {
  it('lists the bundled GB and IE summaries without loading channel data', () => {
    const codes = availableCountries().map((country) => country.countryCode);
    expect(codes).toEqual(['GB', 'IE']);
  });
});
