import { describe, expect, it } from 'vitest';
import { formatKepsLastUpdated, KEPS_STALE_AFTER_MS } from './kepsLastUpdated.ts';

describe('formatKepsLastUpdated', () => {
  it('returns never refreshed when iso is missing or invalid', () => {
    expect(formatKepsLastUpdated(null)).toEqual({ label: 'Never refreshed', stale: true });
    expect(formatKepsLastUpdated(undefined)).toEqual({ label: 'Never refreshed', stale: true });
    expect(formatKepsLastUpdated('not-a-date')).toEqual({ label: 'Never refreshed', stale: true });
  });

  it('marks fresh timestamps as not stale', () => {
    const now = Date.parse('2026-08-18T12:00:00.000Z');
    const iso = new Date(now - KEPS_STALE_AFTER_MS + 60_000).toISOString();
    const result = formatKepsLastUpdated(iso, { now });
    expect(result.stale).toBe(false);
    expect(result.label).toMatch(/^Last updated: /);
  });

  it('marks timestamps older than seven days as stale', () => {
    const now = Date.parse('2026-08-18T12:00:00.000Z');
    const iso = new Date(now - KEPS_STALE_AFTER_MS - 1).toISOString();
    const result = formatKepsLastUpdated(iso, { now });
    expect(result.stale).toBe(true);
    expect(result.label).toMatch(/^Last updated: /);
  });
});
