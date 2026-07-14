import { describe, expect, it } from 'vitest';
import { radioidListingImportName } from './contactName.ts';
import type { RadioidDmrUserListing } from './types.ts';

const listing: RadioidDmrUserListing = {
  id: 1,
  callsign: 'M7ABC',
  fname: 'Ada',
  surname: 'Lovelace',
  name: 'Ada L',
  city: '',
  state: '',
  country: '',
};

describe('radioidListingImportName', () => {
  it('uses RadioID name field in name mode', () => {
    expect(radioidListingImportName(listing, 'name')).toBe('Ada L');
  });

  it('uses callsign in callsign mode', () => {
    expect(radioidListingImportName(listing, 'callsign')).toBe('M7ABC');
  });

  it('combines callsign and RadioID name in callsign-name mode', () => {
    expect(radioidListingImportName(listing, 'callsign-name')).toBe('M7ABC Ada L');
  });

  it('falls back when preferred field is empty', () => {
    const callsignOnly = { ...listing, name: '' };
    expect(radioidListingImportName(callsignOnly, 'name')).toBe('M7ABC');
  });
});
