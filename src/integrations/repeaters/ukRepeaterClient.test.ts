import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { repeaterListingToChannel } from './mapToChannel.ts';
import {
  mockJsonFetch,
  setupRepeaterDirectoryTestMocks,
  teardownRepeaterDirectoryTestMocks,
} from './testHelpers.ts';
import { RepeaterDirectoryError } from './types.ts';
import { searchUkRepeatersByCallsign } from './ukRepeaterClient.ts';

beforeEach(() => {
  setupRepeaterDirectoryTestMocks();
});

afterEach(() => {
  teardownRepeaterDirectoryTestMocks();
});

describe('searchUkRepeatersByCallsign', () => {
  it('normalises a GB3DA listing into a RepeaterListing', async () => {
    mockJsonFetch(200, {
      data: [
        {
          id: 4120,
          status: 'OPERATIONAL',
          town: 'DANBURY',
          repeater: 'GB3DA',
          modeCodes: ['A', 'F'],
          tx: 145_725_000,
          rx: 145_125_000,
          ctcss: 110.9,
          band: '2M',
          locator: 'JO01GR',
        },
      ],
    });

    const [listing] = await searchUkRepeatersByCallsign('gb3da');
    expect(listing.callsign).toBe('GB3DA');
    expect(listing.name).toBe('DANBURY');
    expect(listing.rxFrequencyHz).toBe(145_725_000);
    expect(listing.txFrequencyHz).toBe(145_125_000);
    expect(listing.toneHz).toBe(110.9);
    expect(listing.modes).toEqual(['fm', 'ysf']);
    expect(listing.primaryMode).toBe('fm');
    expect(listing.location?.lat).toBeCloseTo(51.7, 0);

    const channel = repeaterListingToChannel(listing, 'p1');
    expect(channel.callsign).toBe('GB3DA');
    expect(channel.name).toBe('DANBURY');
  });

  it('parses a DMR listing with colour code', async () => {
    mockJsonFetch(200, {
      data: [
        {
          id: 1,
          repeater: 'GB7XX',
          modeCodes: ['M:1'],
          tx: 439_000_000,
          rx: 430_600_000,
          band: '70CM',
        },
      ],
    });
    const [listing] = await searchUkRepeatersByCallsign('gb7xx');
    expect(listing.modes).toEqual(['dmr']);
    expect(listing.primaryMode).toBe('dmr');
    expect(listing.colourCode).toBe(1);
  });

  it('returns an empty array when data is null', async () => {
    mockJsonFetch(200, { data: null });
    expect(await searchUkRepeatersByCallsign('zz9zzz')).toEqual([]);
  });

  it('throws RepeaterDirectoryError on a non-ok response', async () => {
    mockJsonFetch(503, {});
    await expect(searchUkRepeatersByCallsign('gb3da')).rejects.toBeInstanceOf(
      RepeaterDirectoryError,
    );
  });

  it('reuses session cache on repeated callsign search', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await searchUkRepeatersByCallsign('gb3da');
    await searchUkRepeatersByCallsign('gb3da');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
