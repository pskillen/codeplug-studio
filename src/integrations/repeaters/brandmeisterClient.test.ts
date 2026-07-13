import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchBrandmeisterByCallsign } from './brandmeisterClient.ts';
import {
  mockJsonFetch,
  setupRepeaterDirectoryTestMocks,
  teardownRepeaterDirectoryTestMocks,
} from './testHelpers.ts';
import { RepeaterDirectoryError } from './types.ts';

beforeEach(() => {
  setupRepeaterDirectoryTestMocks();
});

afterEach(() => {
  teardownRepeaterDirectoryTestMocks();
});

describe('searchBrandmeisterByCallsign', () => {
  it('normalises a device with MHz tx/rx into Hz (inverted for repeater convention)', async () => {
    mockJsonFetch(200, {
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
    mockJsonFetch(200, null);
    const listings = await searchBrandmeisterByCallsign('NONE');
    expect(listings).toEqual([]);
  });

  it('wraps a single device object in an array', async () => {
    mockJsonFetch(200, {
      id: 1,
      callsign: 'TEST',
      tx: '430.00000',
      rx: '438.00000',
    });
    const listings = await searchBrandmeisterByCallsign('TEST');
    expect(listings).toHaveLength(1);
  });

  it('throws RepeaterDirectoryError on HTTP failure', async () => {
    mockJsonFetch(500, {});
    await expect(searchBrandmeisterByCallsign('FAIL')).rejects.toBeInstanceOf(
      RepeaterDirectoryError,
    );
  });

  it('reuses session cache on repeated callsign search', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify([{ id: 1, callsign: 'GB7AC', tx: '430', rx: '438' }]), {
          status: 200,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await searchBrandmeisterByCallsign('GB7AC');
    await searchBrandmeisterByCallsign('GB7AC');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
