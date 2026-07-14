import { describe, expect, it } from 'vitest';
import {
  applyRadioidListingUpdates,
  buildDigitalContactPatchFromDiff,
  diffDigitalContactFromListing,
  diffHasChanges,
  radioidListingDisplayName,
} from './contactDiff.ts';
import { newDigitalContact } from '@core/domain/factories.ts';

describe('contactDiff', () => {
  const listing = {
    id: 3109478,
    callsign: 'W1AW',
    fname: 'Hiram',
    surname: 'Percy',
    name: 'Hiram',
    city: 'Newington',
    state: 'Connecticut',
    country: 'United States',
  };

  it('builds display name from RadioID name field by default', () => {
    expect(radioidListingDisplayName(listing)).toBe('Hiram');
    expect(radioidListingDisplayName(listing, 'callsign-name')).toBe('W1AW Hiram');
  });

  it('diffs changed metadata fields', () => {
    const contact = {
      ...newDigitalContact('p1', 'Old Name', 3109478),
      callsign: 'W1AW',
      city: '',
      state: '',
      country: '',
    };
    const rows = diffDigitalContactFromListing(contact, listing);
    expect(diffHasChanges(rows)).toBe(true);
    expect(rows.find((r) => r.field === 'city')?.changed).toBe(true);
  });

  it('applies selected fields from listing', () => {
    const contact = {
      ...newDigitalContact('p1', 'Old Name', 3109478),
      callsign: 'W1AW',
    };
    const patched = buildDigitalContactPatchFromDiff(contact, listing, ['city', 'state']);
    expect(patched.city).toBe('Newington');
    expect(patched.state).toBe('Connecticut');
    expect(patched.name).toBe('Old Name');
  });

  it('applyRadioidListingUpdates returns null when unchanged', () => {
    const contact = {
      ...newDigitalContact('p1', 'Hiram', 3109478),
      callsign: 'W1AW',
      city: 'Newington',
      state: 'Connecticut',
      country: 'United States',
    };
    expect(applyRadioidListingUpdates(contact, listing)).toBeNull();
  });
});
