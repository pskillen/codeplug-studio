import { describe, expect, it } from 'vitest';
import {
  filterTrackingPasses,
  formatCountdownMmSs,
  formatLocalClockTime,
  formatNextPassCountdown,
  formatUtcClockTime,
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

describe('filterTrackingPasses', () => {
  const passes = [
    {
      satelliteId: 'a',
      aosAt: '2026-08-10T01:00:00.000Z',
      losAt: '2026-08-10T01:10:00.000Z',
      maxElevationAt: '',
      maxElevationDeg: 40,
      durationSec: 600,
    },
    {
      satelliteId: 'b',
      aosAt: '2026-08-10T02:00:00.000Z',
      losAt: '2026-08-10T02:10:00.000Z',
      maxElevationAt: '',
      maxElevationDeg: 10,
      durationSec: 600,
    },
  ];

  it('filters by min elevation and interested satellites', () => {
    const result = filterTrackingPasses(passes, '20', new Set(['a']));
    expect(result.map((pass) => pass.satelliteId)).toEqual(['a']);
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

describe('formatCountdownMmSs', () => {
  it('formats minutes and zero-padded seconds', () => {
    expect(formatCountdownMmSs(125000)).toBe('2:05');
  });

  it('formats seconds only', () => {
    expect(formatCountdownMmSs(45000)).toBe('0:45');
  });

  it('allows minutes above 59', () => {
    expect(formatCountdownMmSs(3661000)).toBe('61:01');
  });

  it('returns 0:00 for zero or negative duration', () => {
    expect(formatCountdownMmSs(0)).toBe('0:00');
    expect(formatCountdownMmSs(-100)).toBe('0:00');
  });
});

describe('formatNextPassCountdown', () => {
  const aos = '2026-08-10T12:00:00.000Z';
  const los = '2026-08-10T12:30:00.000Z';

  it('returns LOS mm:ss when active', () => {
    expect(formatNextPassCountdown(Date.parse('2026-08-10T12:10:00.000Z'), aos, los)).toBe(
      'LOS 20:00',
    );
  });

  it('returns AOS mm:ss before pass', () => {
    expect(formatNextPassCountdown(Date.parse('2026-08-10T11:59:30.000Z'), aos, los)).toBe(
      'AOS 0:30',
    );
  });

  it('returns null after LOS', () => {
    expect(formatNextPassCountdown(Date.parse('2026-08-10T13:00:00.000Z'), aos, los)).toBeNull();
  });
});

describe('formatUtcClockTime', () => {
  it('formats a 24-hour HH:mm:ss in UTC, never AM/PM', () => {
    expect(formatUtcClockTime('2026-08-10T16:49:52.000Z')).toBe('16:49:52');
  });

  it('zero-pads midnight as 00, not 24', () => {
    expect(formatUtcClockTime('2026-08-10T00:05:09.000Z')).toBe('00:05:09');
  });
});

describe('formatLocalClockTime', () => {
  const iso = '2026-08-10T16:49:52.000Z';

  it('never renders AM/PM', () => {
    expect(formatLocalClockTime(iso)).not.toMatch(/AM|PM/i);
  });

  it("renders 24-hour HH:mm:ss regardless of the test runner's local time zone", () => {
    expect(formatLocalClockTime(iso)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});
