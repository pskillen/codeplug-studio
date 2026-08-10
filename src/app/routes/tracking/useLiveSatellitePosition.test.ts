import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveSatellitePosition } from './useLiveSatellitePosition.ts';

const ISS_LINE_1 = '1 25544U 98067A   24045.51782528  .00016717 00000-0   30589-3 0  9993';
const ISS_LINE_2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.4956032 430001';

describe('useLiveSatellitePosition', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null while TLE lines are absent', () => {
    const { result } = renderHook(() => useLiveSatellitePosition(null, null));
    expect(result.current).toBeNull();
  });

  it('propagates an initial position and re-propagates on each poll interval', async () => {
    const { result } = renderHook(() => useLiveSatellitePosition(ISS_LINE_1, ISS_LINE_2, 2000));

    // Initial tick is deferred (setTimeout 0) to avoid a sync setState-in-effect.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current).not.toBeNull();
    const first = result.current!;
    expect(first.position[0]).toBeGreaterThanOrEqual(-90);
    expect(first.position[0]).toBeLessThanOrEqual(90);
    expect(first.position[1]).toBeGreaterThanOrEqual(-180);
    expect(first.position[1]).toBeLessThanOrEqual(180);
    expect(first.altitudeKm).toBeGreaterThan(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(result.current!.at).not.toBe(first.at);
    // ISS moves fast enough that a 2s later position measurably differs.
    expect(result.current).not.toEqual(first);
  });

  it('clears the interval on unmount', async () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    const { unmount } = renderHook(() => useLiveSatellitePosition(ISS_LINE_1, ISS_LINE_2, 2000));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it('resets to null when TLE lines are cleared', async () => {
    const { result, rerender } = renderHook(
      ({ line1, line2 }: { line1: string | null; line2: string | null }) =>
        useLiveSatellitePosition(line1, line2, 2000),
      { initialProps: { line1: ISS_LINE_1 as string | null, line2: ISS_LINE_2 as string | null } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current).not.toBeNull();

    rerender({ line1: null, line2: null });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current).toBeNull();
  });
});
