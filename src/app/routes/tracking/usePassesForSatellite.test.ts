import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PassResult } from '@core/domain/satelliteTracking/types.ts';
import { usePassesForSatellite } from './usePassesForSatellite.ts';

const PASS: PassResult = {
  aosAt: '2026-08-10T01:00:00.000Z',
  losAt: '2026-08-10T01:10:00.000Z',
  maxElevationAt: '2026-08-10T01:05:00.000Z',
  maxElevationDeg: 30,
  durationSec: 600,
};

const requestPasses = vi.fn();
vi.mock('@integrations/satelliteTracking/passPredictionClient.ts', () => ({
  passPredictionClient: {
    requestPasses: (...args: unknown[]) => requestPasses(...args),
  },
}));

const mockUseTrackingSettings = vi.fn();
vi.mock('../../state/useTrackingSettings.ts', () => ({
  useTrackingSettings: () => mockUseTrackingSettings(),
}));

const SATELLITE = { tleLine1: 'line1', tleLine2: 'line2' };
const FUTURE_WINDOW = {
  fromAt: '2026-08-10T00:00:00.000Z',
  toAt: '2026-08-13T00:00:00.000Z',
};
const PAST_WINDOW = {
  fromAt: '2026-08-07T00:00:00.000Z',
  toAt: '2026-08-10T00:00:00.000Z',
};

describe('usePassesForSatellite', () => {
  it('returns no observer state and skips the worker call when there is no observer location', async () => {
    mockUseTrackingSettings.mockReturnValue({ settings: null });
    requestPasses.mockResolvedValue([PASS]);

    const { result } = renderHook(() => usePassesForSatellite(SATELLITE, FUTURE_WINDOW));

    expect(result.current.hasObserver).toBe(false);
    await waitFor(() => expect(result.current.passes).toEqual([]));
    expect(requestPasses).not.toHaveBeenCalled();
  });

  it('requests passes for a future-facing window once an observer is set', async () => {
    mockUseTrackingSettings.mockReturnValue({
      settings: { location: { lat: 51.5, lon: -0.1 } },
    });
    requestPasses.mockResolvedValue([PASS]);

    const { result } = renderHook(() => usePassesForSatellite(SATELLITE, FUTURE_WINDOW));

    await waitFor(() => expect(result.current.passes).toEqual([PASS]));
    expect(requestPasses).toHaveBeenCalledWith(
      'line1',
      'line2',
      { latDeg: 51.5, lonDeg: -0.1 },
      expect.objectContaining({ fromAt: FUTURE_WINDOW.fromAt, toAt: FUTURE_WINDOW.toAt }),
    );
  });

  it('requests passes for a past-facing window the same way', async () => {
    mockUseTrackingSettings.mockReturnValue({
      settings: { location: { lat: 51.5, lon: -0.1 } },
    });
    requestPasses.mockResolvedValue([]);

    const { result } = renderHook(() => usePassesForSatellite(SATELLITE, PAST_WINDOW));

    await waitFor(() =>
      expect(requestPasses).toHaveBeenCalledWith(
        'line1',
        'line2',
        { latDeg: 51.5, lonDeg: -0.1 },
        expect.objectContaining({ fromAt: PAST_WINDOW.fromAt, toAt: PAST_WINDOW.toAt }),
      ),
    );
    expect(result.current.passes).toEqual([]);
  });

  it('surfaces an error message when the worker call rejects', async () => {
    mockUseTrackingSettings.mockReturnValue({
      settings: { location: { lat: 51.5, lon: -0.1 } },
    });
    requestPasses.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => usePassesForSatellite(SATELLITE, FUTURE_WINDOW));

    await waitFor(() => expect(result.current.error).toBe('boom'));
    expect(result.current.passes).toEqual([]);
  });
});
