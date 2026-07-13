import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BRANDMEISTER_CACHE_PREFIX,
  clearIntegrationCache,
  ETCC_CACHE_PREFIX,
  INTEGRATION_CACHE_TTL_MS,
  integrationCacheKey,
  PHOTON_CACHE_PREFIX,
  readIntegrationCache,
  readStaleIntegrationCache,
  REPEATERBOOK_CACHE_PREFIX,
  writeIntegrationCache,
} from './sessionCache.ts';
import { createSessionStorageMock } from './testHelpers.ts';

describe('sessionCache', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', createSessionStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null on cache miss', () => {
    expect(readIntegrationCache('etcc-api:https://example.test')).toBeNull();
  });

  it('reads and writes within TTL', () => {
    const key = integrationCacheKey(
      ETCC_CACHE_PREFIX,
      'https://api-beta.rsgb.online/callsign/gb3da',
    );
    writeIntegrationCache(key, '{"data":[]}');
    expect(readIntegrationCache(key)).toBe('{"data":[]}');
  });

  it('expires entries after TTL', () => {
    vi.useFakeTimers();
    const key = integrationCacheKey(
      BRANDMEISTER_CACHE_PREFIX,
      'https://api.brandmeister.network/v2/device/byCall',
    );
    writeIntegrationCache(key, '[]');
    vi.advanceTimersByTime(INTEGRATION_CACHE_TTL_MS + 1);
    expect(readIntegrationCache(key)).toBeNull();
    vi.useRealTimers();
  });

  it('readStaleIntegrationCache returns expired body', () => {
    vi.useFakeTimers();
    const key = integrationCacheKey(PHOTON_CACHE_PREFIX, 'https://photon.komoot.io/api/?q=Glasgow');
    writeIntegrationCache(key, '{"features":[]}');
    vi.advanceTimersByTime(INTEGRATION_CACHE_TTL_MS + 1);
    expect(readStaleIntegrationCache(key)).toBe('{"features":[]}');
    vi.useRealTimers();
  });

  it('isolates keys by provider prefix', () => {
    const url = 'https://example.test/path';
    writeIntegrationCache(integrationCacheKey(ETCC_CACHE_PREFIX, url), 'etcc');
    writeIntegrationCache(integrationCacheKey(PHOTON_CACHE_PREFIX, url), 'photon');
    expect(readIntegrationCache(integrationCacheKey(ETCC_CACHE_PREFIX, url))).toBe('etcc');
    expect(readIntegrationCache(integrationCacheKey(PHOTON_CACHE_PREFIX, url))).toBe('photon');
  });

  it('includes token suffix in RepeaterBook cache key', () => {
    const url = '/api/repeaterbook/export?region=na';
    const keyA = integrationCacheKey(REPEATERBOOK_CACHE_PREFIX, url, 'rbuapp_a');
    const keyB = integrationCacheKey(REPEATERBOOK_CACHE_PREFIX, url, 'rbuapp_b');
    writeIntegrationCache(keyA, 'token-a');
    expect(readIntegrationCache(keyA)).toBe('token-a');
    expect(readIntegrationCache(keyB)).toBeNull();
  });

  it('clearIntegrationCache removes only matching prefix', () => {
    writeIntegrationCache(integrationCacheKey(ETCC_CACHE_PREFIX, 'a'), '1');
    writeIntegrationCache(integrationCacheKey(REPEATERBOOK_CACHE_PREFIX, 'b'), '2');
    clearIntegrationCache(REPEATERBOOK_CACHE_PREFIX);
    expect(readIntegrationCache(integrationCacheKey(ETCC_CACHE_PREFIX, 'a'))).toBe('1');
    expect(readIntegrationCache(integrationCacheKey(REPEATERBOOK_CACHE_PREFIX, 'b'))).toBeNull();
  });
});
