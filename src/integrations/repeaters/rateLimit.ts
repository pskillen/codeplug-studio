import { RepeaterDirectoryError } from './types.ts';

export type DirectoryProvider = 'etcc' | 'brandmeister' | 'irts' | 'repeaterbook';

export const DEFAULT_COOLDOWN_MS = 60_000;

const RATE_LIMIT_MESSAGES: Record<DirectoryProvider, string> = {
  repeaterbook: 'RepeaterBook rate limit reached — wait before searching again.',
  etcc: 'ukrepeater.net rate limit — wait before searching again.',
  brandmeister: 'BrandMeister rate limit — wait before searching again.',
  irts: 'IRTS repeater listing rate limit — wait before searching again.',
};

const cooldownUntil = new Map<DirectoryProvider, number>();

/** Parse Retry-After header (seconds or HTTP-date) into milliseconds. */
export function parseRetryAfterMs(header: string | null, fallbackMs = DEFAULT_COOLDOWN_MS): number {
  if (!header?.trim()) return fallbackMs;
  const trimmed = header.trim();
  const seconds = Number.parseInt(trimmed, 10);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const dateMs = Date.parse(trimmed);
  if (Number.isFinite(dateMs)) {
    const delta = dateMs - Date.now();
    return delta > 0 ? delta : fallbackMs;
  }
  return fallbackMs;
}

export function rateLimitMessage(provider: DirectoryProvider): string {
  return RATE_LIMIT_MESSAGES[provider];
}

export function isRateLimited(provider: DirectoryProvider, now = Date.now()): boolean {
  const until = cooldownUntil.get(provider);
  return until != null && now < until;
}

/** Throws when provider is in cooldown after a prior 429. */
export function assertNotRateLimited(provider: DirectoryProvider, now = Date.now()): void {
  if (isRateLimited(provider, now)) {
    throw new RepeaterDirectoryError(rateLimitMessage(provider), 429);
  }
}

export function recordRateLimit(
  provider: DirectoryProvider,
  retryAfterMs = DEFAULT_COOLDOWN_MS,
  now = Date.now(),
): void {
  cooldownUntil.set(provider, now + Math.max(0, retryAfterMs));
}

export function clearRateLimitState(provider?: DirectoryProvider): void {
  if (provider) {
    cooldownUntil.delete(provider);
    return;
  }
  cooldownUntil.clear();
}
