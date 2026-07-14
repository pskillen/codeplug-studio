import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { searchRadioidDmrUsers } from './client.ts';
import { mapRadioidUserToDigitalContact } from './mapToDigitalContact.ts';
import { findDigitalContactByDigitalId } from './findDigitalContact.ts';

const FIXTURE_RESPONSE = {
  count: 1,
  page: 1,
  pages: 1,
  per_page: 1,
  results: [
    {
      id: 3109478,
      callsign: 'W1AW',
      fname: 'Hiram',
      surname: '',
      name: 'Hiram',
      city: 'Newington',
      state: 'Connecticut',
      country: 'United States',
    },
  ],
};

describe('radioid client', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(FIXTURE_RESPONSE), { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('searches DMR users via proxy path', async () => {
    const result = await searchRadioidDmrUsers({ callsign: 'W1AW', callsign_sel: '=' });
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.callsign).toBe('W1AW');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/radioid/dmr/user?callsign=W1AW&callsign_sel=%3D'),
      undefined,
    );
  });
});

describe('mapRadioidUserToDigitalContact', () => {
  it('maps fname and surname to display name with callsign metadata', () => {
    const contact = mapRadioidUserToDigitalContact(
      {
        id: 3109478,
        callsign: 'W1AW',
        fname: 'Hiram',
        surname: 'Percy',
        name: 'Hiram',
        city: 'Newington',
        state: 'Connecticut',
        country: 'United States',
      },
      'project-1',
    );
    expect(contact.name).toBe('Hiram Percy');
    expect(contact.callsign).toBe('W1AW');
    expect(contact.digitalId).toBe(3109478);
    expect(contact.city).toBe('Newington');
  });

  it('falls back to callsign when name parts are empty', () => {
    const contact = mapRadioidUserToDigitalContact(
      {
        id: 99,
        callsign: 'M1ABC',
        fname: '',
        surname: '',
        name: '',
        city: '',
        state: '',
        country: '',
      },
      'project-1',
    );
    expect(contact.name).toBe('M1ABC');
  });
});

describe('findDigitalContactByDigitalId', () => {
  it('finds contact by numeric ID', () => {
    const existing = mapRadioidUserToDigitalContact(
      {
        id: 42,
        callsign: 'M1ABC',
        fname: 'Test',
        surname: 'Op',
        name: 'Test',
        city: '',
        state: '',
        country: '',
      },
      'p1',
    );
    expect(findDigitalContactByDigitalId([existing], 42)?.id).toBe(existing.id);
    expect(findDigitalContactByDigitalId([existing], 99)).toBeNull();
  });
});
