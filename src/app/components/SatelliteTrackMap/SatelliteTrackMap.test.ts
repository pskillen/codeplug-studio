import { describe, expect, it } from 'vitest';
import { computeTrackBounds } from './SatelliteTrackMap.tsx';

describe('computeTrackBounds', () => {
  it('returns the strict AOS/LOS window when draw-ahead/behind are both 0', () => {
    const { fromAt, toAt } = computeTrackBounds(
      '2024-02-14T18:00:00.000Z',
      '2024-02-14T18:10:00.000Z',
      0,
      0,
    );

    expect(fromAt).toBe('2024-02-14T18:00:00.000Z');
    expect(toAt).toBe('2024-02-14T18:10:00.000Z');
  });

  it('extends the start earlier by drawBehindMin, relative to aosAt', () => {
    const { fromAt, toAt } = computeTrackBounds(
      '2024-02-14T18:00:00.000Z',
      '2024-02-14T18:10:00.000Z',
      5,
      0,
    );

    expect(fromAt).toBe('2024-02-14T17:55:00.000Z');
    expect(toAt).toBe('2024-02-14T18:10:00.000Z');
  });

  it('extends the end later by drawAheadMin, relative to losAt', () => {
    const { fromAt, toAt } = computeTrackBounds(
      '2024-02-14T18:00:00.000Z',
      '2024-02-14T18:10:00.000Z',
      0,
      7,
    );

    expect(fromAt).toBe('2024-02-14T18:00:00.000Z');
    expect(toAt).toBe('2024-02-14T18:17:00.000Z');
  });

  it('extends both ends when drawBehindMin and drawAheadMin are both set', () => {
    const { fromAt, toAt } = computeTrackBounds(
      '2024-02-14T18:00:00.000Z',
      '2024-02-14T18:10:00.000Z',
      3,
      4,
    );

    expect(fromAt).toBe('2024-02-14T17:57:00.000Z');
    expect(toAt).toBe('2024-02-14T18:14:00.000Z');
  });
});
