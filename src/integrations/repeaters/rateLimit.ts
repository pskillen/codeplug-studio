import {
  assertNotRateLimited as assertNotRateLimitedBase,
  clearRateLimitState,
  DEFAULT_COOLDOWN_MS,
  isRateLimited,
  parseRetryAfterMs,
  recordRateLimit,
} from '../http/rateLimit.ts';
import { RepeaterDirectoryError } from './types.ts';

export type DirectoryProvider = 'etcc' | 'brandmeister' | 'irts' | 'repeaterbook';

export {
  clearRateLimitState,
  DEFAULT_COOLDOWN_MS,
  isRateLimited,
  parseRetryAfterMs,
  recordRateLimit,
};

const RATE_LIMIT_MESSAGES: Record<DirectoryProvider, string> = {
  repeaterbook: 'RepeaterBook rate limit reached — wait before searching again.',
  etcc: 'ukrepeater.net rate limit — wait before searching again.',
  brandmeister: 'BrandMeister rate limit — wait before searching again.',
  irts: 'IRTS repeater listing rate limit — wait before searching again.',
};

export function rateLimitMessage(provider: DirectoryProvider): string {
  return RATE_LIMIT_MESSAGES[provider];
}

/** Throws when provider is in cooldown after a prior 429. */
export function assertNotRateLimited(provider: DirectoryProvider, now = Date.now()): void {
  assertNotRateLimitedBase(
    provider,
    rateLimitMessage(provider),
    (message, status) => new RepeaterDirectoryError(message, status),
    now,
  );
}
