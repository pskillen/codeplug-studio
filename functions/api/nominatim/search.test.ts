import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALLOWED_LOCAL_DEV_ORIGIN } from '../../lib/codeplugOrigin.ts';
import { onRequestGet, onRequestOptions } from './search.ts';

function requestWithOrigin(url: string, origin: string | null = ALLOWED_LOCAL_DEV_ORIGIN): Request {
  return new Request(url, {
    headers: origin ? { Origin: origin } : {},
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('onRequestOptions', () => {
  it('returns 204 with CORS preflight headers for an allowed origin', async () => {
    const response = await onRequestOptions({
      request: requestWithOrigin('https://codeplug.mm9pdy.net/api/nominatim/search'),
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_LOCAL_DEV_ORIGIN);
  });

  it('rejects an unrecognised origin', async () => {
    const response = await onRequestOptions({
      request: requestWithOrigin(
        'https://codeplug.mm9pdy.net/api/nominatim/search',
        'https://evil.com',
      ),
    });
    expect(response.status).toBe(403);
  });
});

describe('onRequestGet', () => {
  it('rejects an unrecognised origin', async () => {
    const response = await onRequestGet({
      request: requestWithOrigin(
        'https://codeplug.mm9pdy.net/api/nominatim/search?q=Glasgow',
        'https://evil.com',
      ),
    });
    expect(response.status).toBe(403);
  });

  it('rejects a missing q param without calling upstream', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const response = await onRequestGet({
      request: requestWithOrigin('https://codeplug.mm9pdy.net/api/nominatim/search'),
    });

    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('proxies to Nominatim with an identifying User-Agent and mirrors the JSON body', async () => {
    const upstreamBody = JSON.stringify([{ lat: '55.86', lon: '-4.25', display_name: 'Glasgow' }]);
    const fetchSpy = vi.fn().mockResolvedValue(new Response(upstreamBody, { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    const response = await onRequestGet({
      request: requestWithOrigin('https://codeplug.mm9pdy.net/api/nominatim/search?q=Glasgow'),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(upstreamBody);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_LOCAL_DEV_ORIGIN);

    const [upstreamUrl, upstreamInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(upstreamUrl).toContain('nominatim.openstreetmap.org/search');
    expect(upstreamUrl).toContain('q=Glasgow');
    const headers = new Headers(upstreamInit.headers);
    expect(headers.get('User-Agent')).toContain('CodeplugStudio');
  });

  it('returns 502 when the upstream request throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const response = await onRequestGet({
      request: requestWithOrigin('https://codeplug.mm9pdy.net/api/nominatim/search?q=Glasgow'),
    });

    expect(response.status).toBe(502);
  });

  it('returns 502 when Nominatim responds with a non-2xx status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 503 })));

    const response = await onRequestGet({
      request: requestWithOrigin('https://codeplug.mm9pdy.net/api/nominatim/search?q=Glasgow'),
    });

    expect(response.status).toBe(502);
  });
});
