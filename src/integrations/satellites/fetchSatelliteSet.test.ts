import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchSatelliteSet } from './fetchSatelliteSet.ts';
import {
  mockTextFetch,
  setupSatelliteDirectoryTestMocks,
  teardownSatelliteDirectoryTestMocks,
} from './testHelpers.ts';
import { clearDirectoryCache } from './sessionCache.ts';

const validTle = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../core/domain/tle/__fixtures__/valid.tle'),
  'utf8',
);

beforeEach(() => {
  setupSatelliteDirectoryTestMocks();
});

afterEach(() => {
  teardownSatelliteDirectoryTestMocks();
  clearDirectoryCache();
});

describe('fetchSatelliteSet', () => {
  it('returns parsed entries from CelesTrak when it succeeds', async () => {
    mockTextFetch(200, validTle);
    const result = await fetchSatelliteSet();
    expect(result.source).toBe('celestrak');
    expect(result.entries).toHaveLength(2);
    expect(result.warnings).toEqual([]);
  });

  it('falls back to AMSAT when CelesTrak is unreachable', async () => {
    let call = 0;
    vi.stubGlobal('fetch', async () => {
      call += 1;
      if (call === 1) throw new Error('network error');
      return new Response(validTle, { status: 200 });
    });

    const result = await fetchSatelliteSet();
    expect(result.source).toBe('amsat');
    expect(result.entries).toHaveLength(2);
    expect(call).toBe(2);
  });

  it('propagates the AMSAT error when both sources fail', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('network error');
    });

    await expect(fetchSatelliteSet()).rejects.toThrow();
  });
});
