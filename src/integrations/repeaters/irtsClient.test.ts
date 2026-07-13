import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearIrtsCatalogueCache,
  fetchIrtsRepeaters,
  filterIrtsListings,
  parseIrtsAnytoneCsv,
  searchIrtsByCallsign,
} from './irtsClient.ts';
import {
  mockTextFetch,
  setupRepeaterDirectoryTestMocks,
  teardownRepeaterDirectoryTestMocks,
} from './testHelpers.ts';
import { RepeaterDirectoryError } from './types.ts';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__/irts');
const sampleCsv = readFileSync(join(fixtureDir, 'anytone-sample.csv'), 'utf8');

function mockFetchCsv(status: number, body: string) {
  mockTextFetch(status, body);
}

beforeEach(() => {
  setupRepeaterDirectoryTestMocks();
});

afterEach(() => {
  teardownRepeaterDirectoryTestMocks();
  clearIrtsCatalogueCache();
});

describe('parseIrtsAnytoneCsv', () => {
  it('maps analogue and digital rows into RepeaterListing', () => {
    const listings = parseIrtsAnytoneCsv(sampleCsv);
    expect(listings).toHaveLength(3);

    const analogue = listings.find((l) => l.callsign === 'EI2TRR');
    expect(analogue).toMatchObject({
      source: 'irts',
      callsign: 'EI2TRR',
      name: 'Three Roc',
      rxFrequencyHz: 145_600_000,
      txFrequencyHz: 145_000_000,
      toneHz: 88.5,
      modes: ['fm'],
      primaryMode: 'fm',
      colourCode: null,
      band: '2M',
      remoteId: 'EI2TRR@145.60000',
    });

    const dmr = listings.find((l) => l.callsign === 'EI7FXD');
    expect(dmr).toMatchObject({
      source: 'irts',
      modes: ['dmr'],
      primaryMode: 'dmr',
      colourCode: 1,
      toneHz: null,
      band: '70CM',
    });

    const dmrCc2 = listings.find((l) => l.callsign === 'EI7PMD');
    expect(dmrCc2?.colourCode).toBe(2);
  });

  it('throws when required columns are missing', () => {
    expect(() => parseIrtsAnytoneCsv('a,b\n1,2')).toThrow(RepeaterDirectoryError);
  });
});

describe('filterIrtsListings', () => {
  const listings = parseIrtsAnytoneCsv(sampleCsv);

  it('filters by callsign substring', () => {
    const filtered = filterIrtsListings(listings, { query: 'ei7' });
    expect(filtered.map((l) => l.callsign)).toEqual(['EI7FXD', 'EI7PMD']);
  });

  it('filters by band and mode', () => {
    expect(filterIrtsListings(listings, { bands: ['2M'] })).toHaveLength(1);
    expect(filterIrtsListings(listings, { bands: ['2M', '70CM'] })).toHaveLength(3);
    expect(filterIrtsListings(listings, { modes: ['dmr'] })).toHaveLength(2);
  });
});

describe('fetchIrtsRepeaters', () => {
  it('loads and caches catalogue from API path', async () => {
    mockFetchCsv(200, sampleCsv);
    const first = await fetchIrtsRepeaters();
    expect(first).toHaveLength(3);
    const second = await fetchIrtsRepeaters();
    expect(second).toHaveLength(3);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('throws on HTTP failure', async () => {
    mockFetchCsv(502, '');
    await expect(fetchIrtsRepeaters()).rejects.toBeInstanceOf(RepeaterDirectoryError);
  });
});

describe('searchIrtsByCallsign', () => {
  it('returns exact callsign matches case-insensitively', async () => {
    mockFetchCsv(200, sampleCsv);
    const listings = await searchIrtsByCallsign('ei7fxd');
    expect(listings).toHaveLength(1);
    expect(listings[0]?.callsign).toBe('EI7FXD');
  });
});
