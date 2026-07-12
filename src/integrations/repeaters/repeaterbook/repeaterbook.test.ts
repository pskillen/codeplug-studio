import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseRepeaterBookListing, parseRepeaterBookListings } from './parseListing.ts';
import { parseRepeaterBookModes, isRepeaterBookOperational } from './modeMapping.ts';
import { filterRepeaterBookListings } from './queryRouter.ts';
import { buildRepeaterBookExportUrl, fetchRepeaterBookExport } from './repeaterbookClient.ts';
import { clearRepeaterBookSessionCache } from './sessionCache.ts';
import { REPEATERBOOK_USER_AGENT } from './constants.ts';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), '../__fixtures__/repeaterbook');

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(fixtureDir, name), 'utf8'));
}

describe('parseRepeaterBookModes', () => {
  it('maps FM and DMR capability flags', () => {
    const parsed = parseRepeaterBookModes({
      'FM Analog': 'Yes',
      DMR: 'Yes',
      'DMR Color Code': '1',
    });
    expect(parsed.modes).toEqual(['fm', 'dmr']);
    expect(parsed.primaryMode).toBe('fm');
    expect(parsed.colourCode).toBe(1);
  });
});

describe('parseRepeaterBookListing', () => {
  it('normalises NA export row from fixture', () => {
    const body = loadFixture('na-analog-dmr.json') as { results: Record<string, unknown>[] };
    const listing = parseRepeaterBookListing(body.results[0]!);
    expect(listing).toMatchObject({
      source: 'repeaterbook',
      remoteId: '06:42',
      callsign: 'W6TEST',
      rxFrequencyHz: 146_880_000,
      txFrequencyHz: 146_280_000,
      toneHz: 100,
      primaryMode: 'fm',
      status: 'On-air',
    });
    expect(listing?.modes).toEqual(['fm', 'dmr']);
    expect(listing?.location).toEqual({ lat: 34.0522, lon: -118.2437 });
  });
});

describe('isRepeaterBookOperational', () => {
  it('recognises On-air status', () => {
    expect(isRepeaterBookOperational('On-air')).toBe(true);
    expect(isRepeaterBookOperational('Off-air')).toBe(false);
  });
});

describe('filterRepeaterBookListings', () => {
  it('filters operational and band client-side', () => {
    const listings = parseRepeaterBookListings(
      (loadFixture('na-analog-dmr.json') as { results: unknown[] }).results,
    );
    expect(filterRepeaterBookListings(listings, { operationalOnly: true })).toHaveLength(1);
    expect(filterRepeaterBookListings(listings, { bands: ['70CM'] })).toHaveLength(0);
  });
});

describe('buildRepeaterBookExportUrl', () => {
  it('builds NA state and callsign query', () => {
    const url = buildRepeaterBookExportUrl('na', { state_id: '06', callsign: 'W6%' });
    expect(url).toContain('export.php');
    expect(url).toContain('state_id=06');
    expect(url).toContain('callsign=W6%25');
  });

  it('builds ROW country query', () => {
    const url = buildRepeaterBookExportUrl('row', { country: 'Switzerland' });
    expect(url).toContain('exportROW.php');
    expect(url).toContain('country=Switzerland');
  });
});

describe('fetchRepeaterBookExport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearRepeaterBookSessionCache();
  });

  it('requires token before fetch', async () => {
    await expect(fetchRepeaterBookExport('https://example.test', '')).rejects.toMatchObject({
      message: expect.stringContaining('token required'),
    });
  });

  it('maps auth and rate limit errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'error', code: 'auth_invalid' }), { status: 401 }),
      ),
    );
    await expect(
      fetchRepeaterBookExport('https://example.test', 'rbuapp_test'),
    ).rejects.toMatchObject({
      message: expect.stringContaining('invalid'),
    });
  });

  it('uses cache on repeated URL', async () => {
    const body = loadFixture('na-analog-dmr.json');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const url = 'https://www.repeaterbook.com/api/export.php?callsign=W6TEST';
    const first = await fetchRepeaterBookExport(url, 'rbuapp_testtoken');
    const second = await fetchRepeaterBookExport(url, 'rbuapp_testtoken');

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.headers?.['User-Agent']).toBe(REPEATERBOOK_USER_AGENT);
  });

  it('surfaces 429 rate limit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'error', code: 'rate_limited' }), { status: 429 }),
      ),
    );
    await expect(
      fetchRepeaterBookExport('https://example.test', 'rbuapp_test'),
    ).rejects.toMatchObject({
      message: expect.stringContaining('rate limit'),
      status: 429,
    });
  });
});
