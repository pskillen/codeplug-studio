import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALLOWED_LOCAL_DEV_ORIGIN } from '../../lib/codeplugOrigin.ts';
import { onRequestGet, onRequestOptions } from './transmitters.ts';

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
      request: requestWithOrigin('https://codeplug.mm9pdy.net/api/satnogs/transmitters'),
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_LOCAL_DEV_ORIGIN);
  });

  it('rejects an unrecognised origin', async () => {
    const response = await onRequestOptions({
      request: requestWithOrigin(
        'https://codeplug.mm9pdy.net/api/satnogs/transmitters',
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
        'https://codeplug.mm9pdy.net/api/satnogs/transmitters?satellite__norad_cat_id=25544',
        'https://evil.com',
      ),
    });
    expect(response.status).toBe(403);
  });

  it('proxies to SatNOGS DB, forwards query params, and pins JSON format', async () => {
    const upstreamBody = JSON.stringify([
      { uuid: 'abc', norad_cat_id: 25544, mode: 'FM', alive: true, status: 'active' },
    ]);
    const fetchSpy = vi.fn().mockResolvedValue(new Response(upstreamBody, { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    const response = await onRequestGet({
      request: requestWithOrigin(
        'https://codeplug.mm9pdy.net/api/satnogs/transmitters?satellite__norad_cat_id=25544',
      ),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(upstreamBody);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_LOCAL_DEV_ORIGIN);

    const [upstreamUrl] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(upstreamUrl).toContain('db.satnogs.org/api/transmitters/');
    expect(upstreamUrl).toContain('satellite__norad_cat_id=25544');
    expect(upstreamUrl).toContain('format=json');
  });

  it('does not override an explicit format param', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    await onRequestGet({
      request: requestWithOrigin(
        'https://codeplug.mm9pdy.net/api/satnogs/transmitters?satellite__norad_cat_id=25544&format=json',
      ),
    });

    const [upstreamUrl] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const matches = upstreamUrl.match(/format=json/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('returns 502 when the upstream request throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const response = await onRequestGet({
      request: requestWithOrigin(
        'https://codeplug.mm9pdy.net/api/satnogs/transmitters?satellite__norad_cat_id=25544',
      ),
    });

    expect(response.status).toBe(502);
  });

  it('returns 502 when SatNOGS DB responds with a non-2xx status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 503 })));

    const response = await onRequestGet({
      request: requestWithOrigin(
        'https://codeplug.mm9pdy.net/api/satnogs/transmitters?satellite__norad_cat_id=25544',
      ),
    });

    expect(response.status).toBe(502);
  });
});
