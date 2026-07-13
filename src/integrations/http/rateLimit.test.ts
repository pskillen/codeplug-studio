import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertNotRateLimited,
  clearRateLimitState,
  DEFAULT_COOLDOWN_MS,
  isRateLimited,
  parseRetryAfterMs,
  recordRateLimit,
} from './rateLimit.ts';

describe('rateLimit', () => {
  beforeEach(() => {
    clearRateLimitState();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T12:00:00Z'));
  });

  afterEach(() => {
    clearRateLimitState();
    vi.useRealTimers();
  });

  it('parseRetryAfterMs reads seconds', () => {
    expect(parseRetryAfterMs('30')).toBe(30_000);
  });

  it('recordRateLimit blocks subsequent assertNotRateLimited', () => {
    recordRateLimit('photon');
    expect(() =>
      assertNotRateLimited('photon', 'Photon rate limit', (msg) => new Error(msg)),
    ).toThrow('Photon rate limit');
  });

  it('isolates providers', () => {
    recordRateLimit('photon');
    expect(isRateLimited('photon')).toBe(true);
    expect(isRateLimited('etcc')).toBe(false);
    expect(() =>
      assertNotRateLimited('etcc', 'ETCC rate limit', (msg) => new Error(msg)),
    ).not.toThrow();
  });

  it('honours custom retry-after duration', () => {
    recordRateLimit('brandmeister', 120_000);
    vi.advanceTimersByTime(60_001);
    expect(isRateLimited('brandmeister')).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(isRateLimited('brandmeister')).toBe(false);
  });

  it('parseRetryAfterMs falls back when header missing', () => {
    expect(parseRetryAfterMs(null)).toBe(DEFAULT_COOLDOWN_MS);
  });
});
