import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fetchCelestrakAmateurTle } from './celestrakClient.ts';
import {
  mockTextFetch,
  mockTextFetchError,
  setupSatelliteDirectoryTestMocks,
  teardownSatelliteDirectoryTestMocks,
} from './testHelpers.ts';
import { clearDirectoryCache } from './sessionCache.ts';
import { SatelliteDirectoryError } from './types.ts';

const SAMPLE_TLE = 'ISS (ZARYA)\n1 25544U ...\n2 25544  51.6416 ...';

beforeEach(() => {
  setupSatelliteDirectoryTestMocks();
});

afterEach(() => {
  teardownSatelliteDirectoryTestMocks();
  clearDirectoryCache();
});

describe('fetchCelestrakAmateurTle', () => {
  it('fetches and caches the feed', async () => {
    mockTextFetch(200, SAMPLE_TLE);
    const first = await fetchCelestrakAmateurTle();
    expect(first).toBe(SAMPLE_TLE);

    const second = await fetchCelestrakAmateurTle();
    expect(second).toBe(SAMPLE_TLE);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('bypasses cache when refresh is requested', async () => {
    mockTextFetch(200, SAMPLE_TLE);
    await fetchCelestrakAmateurTle();
    await fetchCelestrakAmateurTle({ refresh: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('throws SatelliteDirectoryError on HTTP failure', async () => {
    mockTextFetch(502, '');
    await expect(fetchCelestrakAmateurTle()).rejects.toBeInstanceOf(SatelliteDirectoryError);
  });

  it('throws SatelliteDirectoryError on network failure', async () => {
    mockTextFetchError();
    await expect(fetchCelestrakAmateurTle()).rejects.toBeInstanceOf(SatelliteDirectoryError);
  });

  it('throws SatelliteDirectoryError and enters cooldown on 429', async () => {
    mockTextFetch(429, '');
    await expect(fetchCelestrakAmateurTle()).rejects.toBeInstanceOf(SatelliteDirectoryError);
    mockTextFetch(200, SAMPLE_TLE);
    await expect(fetchCelestrakAmateurTle()).rejects.toBeInstanceOf(SatelliteDirectoryError);
  });
});
