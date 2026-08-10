import type { SatelliteEnrichmentSource, SatelliteSource } from '@core/models/satellite.ts';
import {
  assertNotRateLimited as assertNotRateLimitedBase,
  clearRateLimitState,
  DEFAULT_COOLDOWN_MS,
  isRateLimited,
  parseRetryAfterMs,
  recordRateLimit,
} from '../http/rateLimit.ts';
import { SatelliteDirectoryError } from './types.ts';

export type { SatelliteSource as SatelliteDirectoryProvider };

/** Any upstream this integration talks to — TLE sources plus enrichment sources. */
export type SatelliteRateLimitProvider = SatelliteSource | SatelliteEnrichmentSource;

export {
  clearRateLimitState,
  DEFAULT_COOLDOWN_MS,
  isRateLimited,
  parseRetryAfterMs,
  recordRateLimit,
};

const RATE_LIMIT_MESSAGES: Record<SatelliteRateLimitProvider, string> = {
  celestrak: 'CelesTrak rate limit — wait before refreshing again.',
  amsat: 'AMSAT rate limit — wait before refreshing again.',
  satnogs: 'SatNOGS rate limit — wait before refreshing again.',
};

export function rateLimitMessage(provider: SatelliteRateLimitProvider): string {
  return RATE_LIMIT_MESSAGES[provider];
}

/** Throws when provider is in cooldown after a prior 429. */
export function assertNotRateLimited(provider: SatelliteRateLimitProvider, now = Date.now()): void {
  assertNotRateLimitedBase(
    provider,
    rateLimitMessage(provider),
    (message, status) => new SatelliteDirectoryError(message, status),
    now,
  );
}
