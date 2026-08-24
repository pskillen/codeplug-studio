import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandMeisterInactiveDeviceMessage,
  isBrandMeisterDeviceInactive,
  searchBrandmeisterByCallsign,
} from './brandmeisterClient.ts';
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

describe('isBrandMeisterDeviceInactive', () => {
  it('detects zero frequencies with lastKnownMaster 9999', () => {
    expect(
      isBrandMeisterDeviceInactive({
        id: 235412,
        callsign: 'GB7LV',
        tx: '0.0000',
        rx: '0.0000',
        lastKnownMaster: 9999,
        status: 3,
        statusText: 'Both Slots Linked',
      }),
    ).toBe(true);
  });

  it('ignores status alone when frequencies and master look valid', () => {
    expect(
      isBrandMeisterDeviceInactive({
        id: 1,
        callsign: 'GB7AC',
        tx: '430.00000',
        rx: '438.00000',
        lastKnownMaster: 2501,
        status: 3,
      }),
    ).toBe(false);
  });

  it('requires lastKnownMaster 9999 even when frequencies are zero', () => {
    expect(
      isBrandMeisterDeviceInactive({
        id: 1,
        callsign: 'GB7AC',
        tx: '0.0000',
        rx: '0.0000',
        lastKnownMaster: 2501,
      }),
    ).toBe(false);
  });
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

  it('throws when BrandMeister only returns a retired device stub', async () => {
    mockJsonFetch(200, [
      {
        id: 235412,
        callsign: 'GB7LV',
        tx: '0.0000',
        rx: '0.0000',
        colorcode: 1,
        status: 3,
        lastKnownMaster: 9999,
        lat: 0,
        lng: 0,
        statusText: 'Both Slots Linked',
      },
    ]);

    await expect(searchBrandmeisterByCallsign('GB7LV')).rejects.toMatchObject({
      name: 'RepeaterDirectoryError',
      message: brandMeisterInactiveDeviceMessage('GB7LV'),
    });
  });

  it('filters retired stubs and keeps active devices', async () => {
    mockJsonFetch(200, [
      {
        id: 235412,
        callsign: 'GB7LV',
        tx: '0.0000',
        rx: '0.0000',
        lastKnownMaster: 9999,
        status: 3,
      },
      {
        id: 99,
        callsign: 'GB7LV',
        tx: '430.00000',
        rx: '438.00000',
        lastKnownMaster: 2501,
        city: 'Active',
      },
    ]);

    const listings = await searchBrandmeisterByCallsign('GB7LV');
    expect(listings).toHaveLength(1);
    expect(listings[0]).toMatchObject({
      remoteId: '99',
      name: 'Active',
      rxFrequencyHz: 430_000_000,
    });
  });

  it('throws RepeaterDirectoryError on HTTP failure', async () => {
    mockJsonFetch(500, {});
    await expect(searchBrandmeisterByCallsign('FAIL')).rejects.toBeInstanceOf(
      RepeaterDirectoryError,
    );
  });

  it('reuses session cache on repeated callsign search', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
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
