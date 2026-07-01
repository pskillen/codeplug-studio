import { afterEach, describe, expect, it, vi } from 'vitest';
import { RepeaterDirectoryError } from './types.ts';
import { searchBrandmeisterByCallsign } from './brandmeisterClient.ts';

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('searchBrandmeisterByCallsign', () => {
  it('normalises a device with MHz tx/rx into Hz (inverted for repeater convention)', async () => {
    mockFetch(200, {
      id: 12345,
      callsign: 'GB3RF',
      tx: '430.91250',
      rx: '438.51250',
      colorcode: 1,
      lat: 51.5,
      lng: -0.1,
      city: 'London',
      statusText: 'Online',
    });

    const [listing] = await searchBrandmeisterByCallsign('GB3RF');
    expect(listing).toMatchObject({
      source: 'brandmeister',
      remoteId: '12345',
      callsign: 'GB3RF',
      name: 'London',
      rxFrequencyHz: 430_912_500,
      txFrequencyHz: 438_512_500,
      colourCode: 1,
      modes: ['dmr'],
      primaryMode: 'dmr',
      band: '',
      status: 'Online',
    });
    expect(listing?.location).toEqual({ lat: 51.5, lon: -0.1 });
  });

  it('returns empty array for null response body', async () => {
    mockFetch(200, null);
    const listings = await searchBrandmeisterByCallsign('NONE');
    expect(listings).toEqual([]);
  });

  it('wraps a single device object in an array', async () => {
    mockFetch(200, {
      id: 1,
      callsign: 'TEST',
      tx: '430.00000',
      rx: '438.00000',
    });
    const listings = await searchBrandmeisterByCallsign('TEST');
    expect(listings).toHaveLength(1);
  });

  it('throws RepeaterDirectoryError on HTTP failure', async () => {
    mockFetch(500, {});
    await expect(searchBrandmeisterByCallsign('FAIL')).rejects.toBeInstanceOf(RepeaterDirectoryError);
  });
});
