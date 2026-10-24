import { describe, expect, it, vi } from 'vitest';

import { FirmwareError } from '@core/firmware/errors.ts';

import { createPublicReleaseIndexLoader } from './publicReleaseIndex.ts';

const INDEX_URL = 'https://example.test/repo/main/releases.json';

function response(body: string, status = 200): Response {
  return new Response(body, { status });
}

describe('createPublicReleaseIndexLoader', () => {
  it('fetches the index once, without credentials, and resolves patch paths against it', async () => {
    const fetchImpl = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) =>
      url === INDEX_URL ? response(JSON.stringify({ format: 1, releases: [] })) : response('{}'),
    );
    const load = createPublicReleaseIndexLoader(INDEX_URL, fetchImpl);
    expect(await load()).toEqual([]);
    expect(await load()).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]![1]).toMatchObject({ credentials: 'omit', cache: 'no-cache' });
  });

  it('does not keep a failure, so the next call tries again', async () => {
    const fetchImpl = vi
      .fn<(url: string) => Promise<Response>>()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(response('nope', 503))
      .mockResolvedValueOnce(response(JSON.stringify({ format: 1, releases: [] })));
    const load = createPublicReleaseIndexLoader(INDEX_URL, fetchImpl);
    await expect(load()).rejects.toBeInstanceOf(FirmwareError);
    await expect(load()).rejects.toThrow(/HTTP 503/);
    expect(await load()).toEqual([]);
  });

  it('refuses an index that is not JSON or not the known format', async () => {
    const notJson = createPublicReleaseIndexLoader(INDEX_URL, async () => response('<html>'));
    await expect(notJson()).rejects.toThrow(/not valid JSON/);
    const future = createPublicReleaseIndexLoader(INDEX_URL, async () =>
      response(JSON.stringify({ format: 2, releases: [] })),
    );
    await expect(future()).rejects.toThrow(/unknown format/);
  });
});
