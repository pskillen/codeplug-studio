import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearIntegrationCache } from '../http/sessionCache.ts';
import { clearRateLimitState } from '../http/rateLimit.ts';
import { NOMINATIM_CACHE_PREFIX } from '../http/sessionCache.ts';
import { NominatimSearchError, searchNominatim } from './nominatimClient.ts';

function mockFetchOnce(status: number, body: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(body, { status, headers: new Headers() })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearIntegrationCache(NOMINATIM_CACHE_PREFIX);
  clearRateLimitState('nominatim');
});

describe('searchNominatim', () => {
  it('returns [] without calling fetch for a blank query', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await searchNominatim('   ')).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('parses lat/lon/display_name from the proxy response', async () => {
    mockFetchOnce(
      200,
      JSON.stringify([
        { lat: '55.8642', lon: '-4.2518', display_name: 'Glasgow, Scotland, UK' },
        { lat: 'not-a-number', lon: '0', display_name: 'Bad row' },
      ]),
    );

    const results = await searchNominatim('Glasgow');
    expect(results).toEqual([{ lat: 55.8642, lon: -4.2518, displayName: 'Glasgow, Scotland, UK' }]);
  });

  it('sends the query and a result-count cap only, no extra params', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    await searchNominatim('IO85vs');

    const [url] = fetchSpy.mock.calls[0] as [string];
    const params = new URL(url, 'https://codeplug.mm9pdy.net').searchParams;
    expect(params.get('q')).toBe('IO85vs');
    expect(Number(params.get('limit'))).toBeGreaterThan(0);
    expect([...params.keys()].sort()).toEqual(['limit', 'q']);
  });

  it('throws NominatimSearchError on HTTP failure', async () => {
    mockFetchOnce(502, 'boom');
    await expect(searchNominatim('Glasgow')).rejects.toBeInstanceOf(NominatimSearchError);
  });

  it('throws NominatimSearchError on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(searchNominatim('Glasgow')).rejects.toBeInstanceOf(NominatimSearchError);
  });
});
