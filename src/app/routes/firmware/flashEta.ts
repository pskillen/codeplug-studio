import type { FirmwareFlashCount } from '@integrations/radio-io';

/** No estimate until the transfer has run this long since its first counted block… */
export const FLASH_ETA_WARMUP_MS = 5_000;
/** …and moved this share of the total since then, so the first figure doesn't jump about. */
export const FLASH_ETA_WARMUP_FRACTION = 0.03;

/** One point of the transfer: when (ms, any monotonic clock) and how much was done. */
export interface FlashEtaSample {
  readonly atMs: number;
  readonly done: number;
}

/**
 * The rate's starting point: the first sample with something done. The wait before the first block (the radio
 * erasing) is not part of the transfer rate. Keeps the earlier baseline once set.
 */
export function nextEtaBaseline(
  baseline: FlashEtaSample | null,
  sample: FlashEtaSample,
): FlashEtaSample | null {
  if (baseline) return baseline;
  return sample.done > 0 ? sample : null;
}

/**
 * Time left in ms, from the rate since the baseline; `null` during the warm-up or with nothing to go on. Exactly 0
 * once everything is done.
 */
export function estimateRemainingMs(
  baseline: FlashEtaSample | null,
  now: FlashEtaSample,
  total: number,
): number | null {
  if (total <= 0) return null;
  if (now.done >= total) return 0;
  if (!baseline) return null;
  const dt = now.atMs - baseline.atMs;
  const moved = now.done - baseline.done;
  if (dt < FLASH_ETA_WARMUP_MS || moved < total * FLASH_ETA_WARMUP_FRACTION || moved <= 0) {
    return null;
  }
  return Math.max(0, Math.round(((total - now.done) * dt) / moved));
}

/** `m:ss`, or `h:mm:ss` past an hour. */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** `212 / 478 blocks`, or for bytes `212 / 478 KiB` (whole KiB, never past the total). */
export function formatFlashCount(c: FirmwareFlashCount): string {
  if (c.unit === 'bytes') {
    const total = Math.ceil(c.total / 1024);
    const done = c.done >= c.total ? total : Math.min(Math.floor(c.done / 1024), total);
    return `${done} / ${total} KiB`;
  }
  return `${c.done} / ${c.total} blocks`;
}

/**
 * The line under the transfer: count, elapsed and time left while it runs; elapsed only where no total is known.
 * `remainingMs` null shows "estimating…" once a total is known.
 */
export function formatFlashStats(input: {
  readonly elapsedMs: number;
  readonly written?: FirmwareFlashCount;
  readonly remainingMs: number | null;
}): string {
  const elapsed = `${formatClock(input.elapsedMs)} elapsed`;
  const { written } = input;
  if (!written || written.total <= 0) return elapsed;
  const left =
    input.remainingMs === null
      ? 'estimating time left…'
      : `about ${formatClock(input.remainingMs)} left`;
  return `${formatFlashCount(written)} · ${elapsed} · ${left}`;
}

/** The final line: `478 / 478 blocks in 3:02`, or `3:02` where no total is known. */
export function formatFlashFinal(elapsedMs: number, written?: FirmwareFlashCount): string {
  const time = formatClock(elapsedMs);
  return written && written.total > 0 ? `${formatFlashCount(written)} in ${time}` : time;
}
