import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ObserverLocation } from '@core/domain/satelliteTracking/types.ts';
import { useDopplerShiftedFrequencies } from './useDopplerShiftedFrequencies.ts';

const ISS_LINE_1 = '1 25544U 98067A   24045.51782528  .00016717 00000-0   30589-3 0  9993';
const ISS_LINE_2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.4956032 430001';
const SATELLITE = { tleLine1: ISS_LINE_1, tleLine2: ISS_LINE_2 };
const OBSERVER: ObserverLocation = { latDeg: 51.5, lonDeg: -0.1, heightKm: 0 };
const NOW_MS = Date.parse('2024-02-14T18:00:00.000Z');

describe('useDopplerShiftedFrequencies', () => {
  it('returns nulls when the pass is not active', () => {
    const { result } = renderHook(() =>
      useDopplerShiftedFrequencies(SATELLITE, 145_990_000, 437_800_000, OBSERVER, false, NOW_MS),
    );
    expect(result.current).toEqual({ uplinkHz: null, downlinkHz: null });
  });

  it('returns nulls when there is no observer, even if active', () => {
    const { result } = renderHook(() =>
      useDopplerShiftedFrequencies(SATELLITE, 145_990_000, 437_800_000, null, true, NOW_MS),
    );
    expect(result.current).toEqual({ uplinkHz: null, downlinkHz: null });
  });

  it('returns nulls when there is no satellite, even if active', () => {
    const { result } = renderHook(() =>
      useDopplerShiftedFrequencies(null, 145_990_000, 437_800_000, OBSERVER, true, NOW_MS),
    );
    expect(result.current).toEqual({ uplinkHz: null, downlinkHz: null });
  });

  it('shifts only the frequencies that are set, when active', () => {
    const { result } = renderHook(() =>
      useDopplerShiftedFrequencies(SATELLITE, 145_990_000, null, OBSERVER, true, NOW_MS),
    );
    expect(result.current.downlinkHz).toBeNull();
    expect(result.current.uplinkHz).not.toBeNull();
    // Doppler shift on a LEO pass stays within a few kHz of the transmit frequency.
    expect(Math.abs(result.current.uplinkHz! - 145_990_000)).toBeLessThan(20_000);
    expect(Math.abs(result.current.uplinkHz! - 145_990_000)).toBeGreaterThan(0);
  });
});
