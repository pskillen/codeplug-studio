import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fetchAmsatNasabareTle } from './amsatClient.ts';
import {
  mockTextFetch,
  setupSatelliteDirectoryTestMocks,
  teardownSatelliteDirectoryTestMocks,
} from './testHelpers.ts';
import { clearDirectoryCache } from './sessionCache.ts';
import { SatelliteDirectoryError } from './types.ts';

const SAMPLE_TLE = 'AO-91\n1 43017U ...\n2 43017  97.6123 ...';

beforeEach(() => {
  setupSatelliteDirectoryTestMocks();
});

afterEach(() => {
  teardownSatelliteDirectoryTestMocks();
  clearDirectoryCache();
});

describe('fetchAmsatNasabareTle', () => {
  it('fetches the feed', async () => {
    mockTextFetch(200, SAMPLE_TLE);
    const result = await fetchAmsatNasabareTle();
    expect(result).toBe(SAMPLE_TLE);
  });

  it('throws SatelliteDirectoryError on HTTP failure', async () => {
    mockTextFetch(502, '');
    await expect(fetchAmsatNasabareTle()).rejects.toBeInstanceOf(SatelliteDirectoryError);
  });
});
