import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ObserverLocation } from '@core/domain/satelliteTracking/types.ts';
import { useDopplerShiftedFrequencies } from './useDopplerShiftedFrequencies.ts';

const ISS_LINE_1 = '1 25544U 98067A   24045.51782528  .00016717 00000-0   30589-3 0  9993';
const ISS_LINE_2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.4956032 430001';
const SATELLITE = { tleLine1: ISS_LINE_1, tleLine2: ISS_LINE_2 };
const OBSERVER: ObserverLocation = { latDeg: 51.5, lonDeg: -0.1, heightKm: 0 };
const NOW_MS = Date.parse('2024-02-14T18:00:00.000Z');

const ONE_TRANSMITTER = [{ id: 't1', uplinkHz: 145_990_000, downlinkHz: 437_800_000 }];
const TWO_TRANSMITTERS = [
  { id: 't1', uplinkHz: 145_990_000, downlinkHz: 437_800_000 },
  { id: 't2', uplinkHz: 145_200_000, downlinkHz: 145_800_000 },
];

describe('useDopplerShiftedFrequencies', () => {
  it('returns nulls per transmitter when the pass is not active', () => {
    const { result } = renderHook(() =>
      useDopplerShiftedFrequencies(SATELLITE, ONE_TRANSMITTER, OBSERVER, false, NOW_MS),
    );
    expect(result.current).toEqual([{ id: 't1', uplinkHz: null, downlinkHz: null }]);
  });

  it('returns nulls per transmitter when there is no observer, even if active', () => {
    const { result } = renderHook(() =>
      useDopplerShiftedFrequencies(SATELLITE, ONE_TRANSMITTER, null, true, NOW_MS),
    );
    expect(result.current).toEqual([{ id: 't1', uplinkHz: null, downlinkHz: null }]);
  });

  it('returns nulls per transmitter when there is no satellite, even if active', () => {
    const { result } = renderHook(() =>
      useDopplerShiftedFrequencies(null, ONE_TRANSMITTER, OBSERVER, true, NOW_MS),
    );
    expect(result.current).toEqual([{ id: 't1', uplinkHz: null, downlinkHz: null }]);
  });

  it('shifts only the frequencies that are set, when active', () => {
    const { result } = renderHook(() =>
      useDopplerShiftedFrequencies(
        SATELLITE,
        [{ id: 't1', uplinkHz: 145_990_000, downlinkHz: null }],
        OBSERVER,
        true,
        NOW_MS,
      ),
    );
    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.downlinkHz).toBeNull();
    expect(result.current[0]?.uplinkHz).not.toBeNull();
    // Doppler shift on a LEO pass stays within a few kHz of the transmit frequency.
    expect(Math.abs(result.current[0]!.uplinkHz! - 145_990_000)).toBeLessThan(20_000);
    expect(Math.abs(result.current[0]!.uplinkHz! - 145_990_000)).toBeGreaterThan(0);
  });

  it('applies the same Doppler factor consistently across multiple transmitters at one instant', () => {
    const { result } = renderHook(() =>
      useDopplerShiftedFrequencies(SATELLITE, TWO_TRANSMITTERS, OBSERVER, true, NOW_MS),
    );
    expect(result.current).toHaveLength(2);
    const [t1, t2] = result.current;
    const factor1 = t1!.uplinkHz! / 145_990_000;
    const factor2 = t2!.uplinkHz! / 145_200_000;
    expect(factor1).toBeCloseTo(factor2, 10);
    const rxFactor1 = t1!.downlinkHz! / 437_800_000;
    const rxFactor2 = t2!.downlinkHz! / 145_800_000;
    expect(rxFactor1).toBeCloseTo(factor1, 10);
    expect(rxFactor2).toBeCloseTo(factor1, 10);
  });

  it('preserves transmitter ids in the returned array, in order', () => {
    const { result } = renderHook(() =>
      useDopplerShiftedFrequencies(SATELLITE, TWO_TRANSMITTERS, OBSERVER, false, NOW_MS),
    );
    expect(result.current.map((t) => t.id)).toEqual(['t1', 't2']);
  });
});
