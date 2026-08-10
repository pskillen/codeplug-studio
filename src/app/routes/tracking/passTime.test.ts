import { describe, expect, it } from 'vitest';
import {
  formatCountdown,
  formatNextPassCountdown,
  isPassActive,
  nextPassBySatelliteId,
} from './passTime.ts';

describe('isPassActive', () => {
  const aos = '2026-08-10T12:00:00.000Z';
  const los = '2026-08-10T12:30:00.000Z';

  it('is true when now is inside [AOS, LOS)', () => {
    expect(isPassActive(Date.parse('2026-08-10T12:15:00.000Z'), aos, los)).toBe(true);
  });

  it('is false at AOS boundary (exclusive LOS)', () => {
    expect(isPassActive(Date.parse(los), aos, los)).toBe(false);
  });

  it('is true at AOS', () => {
    expect(isPassActive(Date.parse(aos), aos, los)).toBe(true);
  });

  it('is false before AOS', () => {
    expect(isPassActive(Date.parse('2026-08-10T11:59:00.000Z'), aos, los)).toBe(false);
  });

  it('returns false for invalid ISO strings', () => {
    expect(isPassActive(Date.now(), 'invalid', los)).toBe(false);
  });
});

describe('nextPassBySatelliteId', () => {
  it('keeps earliest AOS per satellite', () => {
    const passes = [
      {
        satelliteId: 'a',
        aosAt: '2026-08-10T14:00:00.000Z',
        losAt: '2026-08-10T14:30:00.000Z',
        maxElevationAt: '',
        maxElevationDeg: 10,
        durationSec: 1800,
      },
      {
        satelliteId: 'a',
        aosAt: '2026-08-10T12:00:00.000Z',
        losAt: '2026-08-10T12:30:00.000Z',
        maxElevationAt: '',
        maxElevationDeg: 20,
        durationSec: 1800,
      },
      {
        satelliteId: 'b',
        aosAt: '2026-08-10T13:00:00.000Z',
        losAt: '2026-08-10T13:30:00.000Z',
        maxElevationAt: '',
        maxElevationDeg: 15,
        durationSec: 1800,
      },
    ];
    const map = nextPassBySatelliteId(passes);
    expect(map.get('a')?.aosAt).toBe('2026-08-10T12:00:00.000Z');
    expect(map.get('b')?.aosAt).toBe('2026-08-10T13:00:00.000Z');
  });

  it('returns empty map for empty input', () => {
    expect(nextPassBySatelliteId([]).size).toBe(0);
  });
});

describe('formatCountdown', () => {
  it('formats hours, minutes, and seconds', () => {
    expect(formatCountdown(3661000)).toBe('1h 1m 1s');
  });

  it('formats minutes and seconds without hours', () => {
    expect(formatCountdown(125000)).toBe('2m 5s');
  });

  it('formats seconds only', () => {
    expect(formatCountdown(45000)).toBe('45s');
  });

  it('returns 0s for zero or negative duration', () => {
    expect(formatCountdown(0)).toBe('0s');
    expect(formatCountdown(-100)).toBe('0s');
  });
});

describe('formatNextPassCountdown', () => {
  const aos = '2026-08-10T12:00:00.000Z';
  const los = '2026-08-10T12:30:00.000Z';

  it('returns In pass when active', () => {
    expect(formatNextPassCountdown(Date.parse('2026-08-10T12:10:00.000Z'), aos, los)).toBe(
      'In pass',
    );
  });

  it('returns countdown to AOS before pass', () => {
    expect(
      formatNextPassCountdown(Date.parse('2026-08-10T11:59:30.000Z'), aos, los),
    ).toBe('30s');
  });

  it('returns null after LOS', () => {
    expect(formatNextPassCountdown(Date.parse('2026-08-10T13:00:00.000Z'), aos, los)).toBeNull();
  });
});
