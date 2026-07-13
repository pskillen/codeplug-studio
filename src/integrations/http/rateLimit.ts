export const DEFAULT_COOLDOWN_MS = 60_000;

const cooldownUntil = new Map<string, number>();

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

export function isRateLimited(provider: string, now = Date.now()): boolean {
  const until = cooldownUntil.get(provider);
  return until != null && now < until;
}

/** Throws when provider is in cooldown after a prior 429. */
export function assertNotRateLimited(
  provider: string,
  message: string,
  createError: (message: string, status?: number) => Error,
  now = Date.now(),
): void {
  if (isRateLimited(provider, now)) {
    throw createError(message, 429);
  }
}

export function recordRateLimit(
  provider: string,
  retryAfterMs = DEFAULT_COOLDOWN_MS,
  now = Date.now(),
): void {
  cooldownUntil.set(provider, now + Math.max(0, retryAfterMs));
}

export function clearRateLimitState(provider?: string): void {
  if (provider) {
    cooldownUntil.delete(provider);
    return;
  }
  cooldownUntil.clear();
}
