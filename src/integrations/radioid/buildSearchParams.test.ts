import { describe, expect, it } from 'vitest';
import { buildRadioidDmrUserSearchParams, hasRadioidSearchFilters } from './buildSearchParams.ts';

describe('buildRadioidDmrUserSearchParams', () => {
  it('returns null when all filters are empty', () => {
    expect(
      buildRadioidDmrUserSearchParams(
        { id: '', callsign: '', city: '', state: '', country: '' },
        1,
      ),
    ).toBeNull();
    expect(
      hasRadioidSearchFilters({ id: '', callsign: '', city: '', state: '', country: '' }),
    ).toBe(false);
  });

  it('maps trimmed filters to API params', () => {
    expect(
      buildRadioidDmrUserSearchParams(
        {
          id: ' 123 ',
          callsign: ' M7 ',
          city: 'London',
          state: 'Eng',
          country: 'United Kingdom',
        },
        2,
      ),
    ).toEqual({
      id: '123',
      id_sel: '=',
      callsign: 'M7',
      callsign_sel: 'B',
      city: 'London',
      city_sel: 'B',
      state: 'Eng',
      state_sel: 'B',
      country: 'United Kingdom',
      country_sel: 'B',
      page: 2,
      per_page: 100,
    });
  });
});
