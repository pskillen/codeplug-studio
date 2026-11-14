import { describe, expect, it } from 'vitest';

import {
  estimateRemainingMs,
  FLASH_ETA_WARMUP_MS,
  formatClock,
  formatFlashCount,
  formatFlashFinal,
  formatFlashStats,
  nextEtaBaseline,
} from './flashEta.ts';

describe('nextEtaBaseline', () => {
  it('waits for the first counted block, then keeps it', () => {
    expect(nextEtaBaseline(null, { atMs: 1000, done: 0 })).toBeNull();
    const first = nextEtaBaseline(null, { atMs: 9000, done: 1 });
    expect(first).toEqual({ atMs: 9000, done: 1 });
    expect(nextEtaBaseline(first, { atMs: 20_000, done: 50 })).toBe(first);
  });
});

describe('estimateRemainingMs', () => {
  const base = { atMs: 10_000, done: 10 };

  it('gives no estimate before the warm-up (too soon, or too little moved)', () => {
    expect(estimateRemainingMs(null, { atMs: 60_000, done: 200 }, 478)).toBeNull();
    // Plenty moved, but not long enough.
    expect(
      estimateRemainingMs(base, { atMs: base.atMs + FLASH_ETA_WARMUP_MS - 1, done: 100 }, 478),
    ).toBeNull();
    // Long enough, but under 3% of the total moved.
    expect(estimateRemainingMs(base, { atMs: 60_000, done: 20 }, 478)).toBeNull();
  });

  it('projects the rate since the baseline onto what is left', () => {
    // 100 blocks in 20 s: 5 blocks/s; 368 left is 73.6 s.
    expect(estimateRemainingMs(base, { atMs: 30_000, done: 110 }, 478)).toBe(73_600);
  });

  it('falls as the transfer moves at a steady rate', () => {
    // 10 blocks/s from the first block at 10 s: the estimate is the time to 1000 blocks at 100 s.
    const steady = { atMs: 10_000, done: 100 };
    const at = (s: number) => estimateRemainingMs(steady, { atMs: s * 1000, done: s * 10 }, 1000)!;
    expect(at(20)).toBe(80_000);
    expect(at(40)).toBe(60_000);
    expect(at(99)).toBe(1_000);
    expect(at(100)).toBe(0);
  });

  it('is exactly 0 once everything is done, even with no baseline', () => {
    expect(estimateRemainingMs(base, { atMs: 200_000, done: 478 }, 478)).toBe(0);
    expect(estimateRemainingMs(null, { atMs: 0, done: 478 }, 478)).toBe(0);
  });

  it('has nothing to say without a total', () => {
    expect(estimateRemainingMs(base, { atMs: 60_000, done: 200 }, 0)).toBeNull();
  });
});

describe('formatting', () => {
  it('formats a clock as m:ss, and h:mm:ss past an hour', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(62_400)).toBe('1:02');
    expect(formatClock(3_725_000)).toBe('1:02:05');
    expect(formatClock(-5)).toBe('0:00');
  });

  it('counts blocks as they are, bytes in whole KiB never past the total', () => {
    expect(formatFlashCount({ done: 212, total: 478, unit: 'blocks' })).toBe('212 / 478 blocks');
    expect(formatFlashCount({ done: 2047, total: 4097, unit: 'bytes' })).toBe('1 / 5 KiB');
    expect(formatFlashCount({ done: 4097, total: 4097, unit: 'bytes' })).toBe('5 / 5 KiB');
  });

  it('shows elapsed only where no total is known', () => {
    expect(formatFlashStats({ elapsedMs: 42_000, remainingMs: null })).toBe('0:42 elapsed');
  });

  it('shows count, elapsed and time left, or that it is still estimating', () => {
    const written = { done: 212, total: 478, unit: 'blocks' } as const;
    expect(formatFlashStats({ elapsedMs: 72_000, written, remainingMs: null })).toBe(
      '212 / 478 blocks · 1:12 elapsed · estimating time left…',
    );
    expect(formatFlashStats({ elapsedMs: 72_000, written, remainingMs: 100_000 })).toBe(
      '212 / 478 blocks · 1:12 elapsed · about 1:40 left',
    );
  });

  it('gives the final count and time', () => {
    expect(formatFlashFinal(182_000, { done: 478, total: 478, unit: 'blocks' })).toBe(
      '478 / 478 blocks in 3:02',
    );
    expect(formatFlashFinal(182_000)).toBe('3:02');
  });
});
