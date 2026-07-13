import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertNotRateLimited,
  clearRateLimitState,
  DEFAULT_COOLDOWN_MS,
  isRateLimited,
  parseRetryAfterMs,
  recordRateLimit,
} from './rateLimit.ts';
import { RepeaterDirectoryError } from './types.ts';

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

  it('parseRetryAfterMs reads HTTP-date', () => {
    const future = new Date('2026-07-13T12:01:30Z').toUTCString();
    expect(parseRetryAfterMs(future)).toBe(90_000);
  });

  it('parseRetryAfterMs falls back when header missing', () => {
    expect(parseRetryAfterMs(null)).toBe(DEFAULT_COOLDOWN_MS);
  });

  it('recordRateLimit blocks subsequent assertNotRateLimited', () => {
    recordRateLimit('brandmeister');
    expect(isRateLimited('brandmeister')).toBe(true);
    expect(() => assertNotRateLimited('brandmeister')).toThrow(RepeaterDirectoryError);
    expect(() => assertNotRateLimited('brandmeister')).toThrow(
      expect.objectContaining({ message: expect.stringContaining('BrandMeister'), status: 429 }),
    );
  });

  it('cooldown expires after window', () => {
    recordRateLimit('etcc', 5_000);
    vi.advanceTimersByTime(5_001);
    expect(isRateLimited('etcc')).toBe(false);
    expect(() => assertNotRateLimited('etcc')).not.toThrow();
  });

  it('isolates providers', () => {
    recordRateLimit('repeaterbook');
    expect(isRateLimited('repeaterbook')).toBe(true);
    expect(isRateLimited('etcc')).toBe(false);
    expect(() => assertNotRateLimited('etcc')).not.toThrow();
  });

  it('honours custom retry-after duration', () => {
    recordRateLimit('brandmeister', 120_000);
    vi.advanceTimersByTime(60_001);
    expect(isRateLimited('brandmeister')).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(isRateLimited('brandmeister')).toBe(false);
  });
});
