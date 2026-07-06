import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RepeaterListing } from '../types.ts';
import { detectQueryKind, filterListings, routeQuery, searchUkRepeaters } from './queryRouter.ts';

vi.mock('@integrations/geocode/index.ts', () => ({
  geocodeQuery: vi.fn(),
}));

vi.mock('../ukRepeaterClient.ts', () => ({
  searchUkRepeatersByCallsign: vi.fn(),
  searchUkRepeatersByLocator: vi.fn(),
  searchUkRepeatersByBand: vi.fn(),
}));

import { geocodeQuery } from '@integrations/geocode/index.ts';
import {
  searchUkRepeatersByBand,
  searchUkRepeatersByCallsign,
  searchUkRepeatersByLocator,
} from '../ukRepeaterClient.ts';

const sampleListing: RepeaterListing = {
  source: 'ukrepeater',
  remoteId: '1',
  callsign: 'GB3A',
  name: 'DERBY',
  rxFrequencyHz: 145_600_000,
  txFrequencyHz: 145_000_000,
  toneHz: null,
  modes: ['fm'],
  primaryMode: 'fm',
  colourCode: null,
  locator: 'IO92',
  location: null,
  band: '2M',
  status: 'OPERATIONAL',
};

const notOperational: RepeaterListing = {
  ...sampleListing,
  remoteId: '2',
  callsign: 'GB3B',
  name: 'NOTTINGHAM',
  status: 'NOT OPERATIONAL',
};

const dmrListing: RepeaterListing = {
  ...sampleListing,
  remoteId: '3',
  callsign: 'GB7DC',
  modes: ['dmr', 'fm'],
  primaryMode: 'dmr',
  band: '70CM',
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('detectQueryKind', () => {
  it('detects callsign', () => {
    expect(detectQueryKind('GB7DC')).toBe('callsign');
  });

  it('detects locator', () => {
    expect(detectQueryKind('IO92')).toBe('locator');
    expect(detectQueryKind('io92pp')).toBe('locator');
  });

  it('detects band', () => {
    expect(detectQueryKind('2m')).toBe('band');
    expect(detectQueryKind('70cm')).toBe('band');
  });

  it('defaults to town for free text', () => {
    expect(detectQueryKind('Derby')).toBe('town');
  });
});

describe('filterListings', () => {
  const listings = [sampleListing, notOperational];

  it('filters operational only', () => {
    expect(filterListings(listings, { operationalOnly: true })).toHaveLength(1);
  });

  it('filters by town substring', () => {
    expect(filterListings(listings, { townSubstring: 'derby' })).toHaveLength(1);
  });

  it('filters by band', () => {
    expect(filterListings(listings, { band: '2M' })).toHaveLength(2);
    expect(filterListings(listings, { band: '70CM' })).toHaveLength(0);
  });

  it('filters by mode', () => {
    const withDmr = [...listings, dmrListing];
    expect(filterListings(withDmr, { modes: ['dmr'] })).toHaveLength(1);
    expect(filterListings(withDmr, { modes: ['fm'] })).toHaveLength(3);
    expect(filterListings(withDmr, { modes: ['ysf'] })).toHaveLength(0);
  });

  it('filters by band and mode together', () => {
    const withDmr = [...listings, dmrListing];
    expect(filterListings(withDmr, { band: '70CM', modes: ['dmr'] })).toHaveLength(1);
    expect(filterListings(withDmr, { band: '2M', modes: ['dmr'] })).toHaveLength(0);
  });

  it('filters by mode and operational status', () => {
    const withDmr = [...listings, dmrListing];
    expect(filterListings(withDmr, { operationalOnly: true, modes: ['dmr'] })).toHaveLength(1);
  });
});

describe('routeQuery', () => {
  it('routes callsign queries', async () => {
    vi.mocked(searchUkRepeatersByCallsign).mockResolvedValue([sampleListing]);
    const result = await routeQuery('GB3A');
    expect(result.kind).toBe('callsign');
    expect(result.listings).toHaveLength(1);
    expect(searchUkRepeatersByCallsign).toHaveBeenCalledWith('GB3A');
  });

  it('routes locator queries', async () => {
    vi.mocked(searchUkRepeatersByLocator).mockResolvedValue([sampleListing]);
    const result = await routeQuery('IO92');
    expect(result.kind).toBe('locator');
    expect(searchUkRepeatersByLocator).toHaveBeenCalledWith('IO92');
  });

  it('returns empty listings for band token queries without calling band API', async () => {
    const result = await routeQuery('2m');
    expect(result.kind).toBe('band');
    expect(result.listings).toHaveLength(0);
    expect(searchUkRepeatersByBand).not.toHaveBeenCalled();
  });

  it('geocodes town queries to locator search', async () => {
    vi.mocked(geocodeQuery).mockResolvedValue({ lat: 52.9, lon: -1.5, label: 'Derby' });
    vi.mocked(searchUkRepeatersByLocator).mockResolvedValue([sampleListing]);
    const result = await routeQuery('Derby', { mapboxToken: 'pk.test' });
    expect(result.kind).toBe('town');
    expect(geocodeQuery).toHaveBeenCalled();
    expect(searchUkRepeatersByLocator).toHaveBeenCalled();
  });
});

describe('searchUkRepeaters', () => {
  it('applies filters after routing', async () => {
    vi.mocked(searchUkRepeatersByCallsign).mockResolvedValue([sampleListing, notOperational]);
    const result = await searchUkRepeaters('GB3', { operationalOnly: true });
    expect(result.kind).toBe('callsign');
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.callsign).toBe('GB3A');
  });

  it('uses query as town substring for town searches', async () => {
    vi.mocked(geocodeQuery).mockResolvedValue({ lat: 52.9, lon: -1.5, label: 'Derby' });
    vi.mocked(searchUkRepeatersByLocator).mockResolvedValue([sampleListing, notOperational]);
    const result = await searchUkRepeaters('Derby', { operationalOnly: true });
    expect(result.listings).toHaveLength(1);
  });

  it('applies band and mode filters after callsign fetch without band API', async () => {
    const withDmr = [sampleListing, dmrListing];
    vi.mocked(searchUkRepeatersByCallsign).mockResolvedValue(withDmr);
    const result = await searchUkRepeaters('GB3', { band: '2M', modes: ['dmr'] });
    expect(result.kind).toBe('callsign');
    expect(result.listings).toHaveLength(0);
    expect(searchUkRepeatersByBand).not.toHaveBeenCalled();
    expect(searchUkRepeatersByCallsign).toHaveBeenCalled();
  });
});
