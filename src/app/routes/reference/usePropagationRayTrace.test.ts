import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RayPathResult, RayTraceParams } from '@core/domain/hfPropagation/types.ts';
import { RAY_TRACE_DEBOUNCE_MS, usePropagationRayTrace } from './usePropagationRayTrace.ts';

const requestRayTrace = vi.fn();

vi.mock('@integrations/hfPropagation/rayTraceClient.ts', () => ({
  rayTraceClient: {
    requestRayTrace: (...args: unknown[]) => requestRayTrace(...args),
  },
}));

const PARAMS: RayTraceParams = {
  frequencyMhz: 14.2,
  antenna: { family: 'omnidirectional-vertical', heightM: 8 },
  layers: [],
  azimuthDeg: 90,
  txLat: 0,
  txLon: 0,
  atMs: 0,
};

const SKY: RayPathResult = {
  mode: 'skywave',
  points: [{ lat: 0, lon: 0, altitudeKm: 0 }],
  takeoffAngleDeg: 20,
  relativeSignalStrength: 1,
};

describe('usePropagationRayTrace', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    requestRayTrace.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not request until the debounce elapses', () => {
    renderHook(() => usePropagationRayTrace(PARAMS));
    expect(requestRayTrace).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(RAY_TRACE_DEBOUNCE_MS - 1);
    });
    expect(requestRayTrace).not.toHaveBeenCalled();
  });

  it('stores the resolved rays after debounce', async () => {
    requestRayTrace.mockResolvedValue([SKY]);
    const { result } = renderHook(() => usePropagationRayTrace(PARAMS));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RAY_TRACE_DEBOUNCE_MS);
    });
    expect(result.current).toEqual([SKY]);
  });

  it('ignores a stale in-flight result after params change', async () => {
    let resolveFirst: ((rays: RayPathResult[]) => void) | undefined;
    requestRayTrace.mockImplementationOnce(
      () =>
        new Promise<RayPathResult[]>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    requestRayTrace.mockResolvedValueOnce([]);

    const { result, rerender } = renderHook(
      ({ params }: { params: RayTraceParams }) => usePropagationRayTrace(params),
      { initialProps: { params: PARAMS } },
    );

    await act(async () => {
      vi.advanceTimersByTime(RAY_TRACE_DEBOUNCE_MS);
    });
    expect(requestRayTrace).toHaveBeenCalledTimes(1);

    rerender({ params: { ...PARAMS, frequencyMhz: 7.1 } });
    await act(async () => {
      vi.advanceTimersByTime(RAY_TRACE_DEBOUNCE_MS);
    });
    expect(requestRayTrace).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveFirst?.([SKY]);
    });
    expect(result.current).toEqual([]);
  });

  it('retriggers when transmitter lat/lon change', async () => {
    requestRayTrace.mockResolvedValue([]);
    const { rerender } = renderHook(
      ({ params }: { params: RayTraceParams }) => usePropagationRayTrace(params),
      { initialProps: { params: PARAMS } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RAY_TRACE_DEBOUNCE_MS);
    });
    expect(requestRayTrace).toHaveBeenCalledTimes(1);
    expect(requestRayTrace).toHaveBeenLastCalledWith(PARAMS);

    rerender({ params: { ...PARAMS, txLat: 51.5, txLon: -0.13 } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RAY_TRACE_DEBOUNCE_MS);
    });
    expect(requestRayTrace).toHaveBeenCalledTimes(2);
    expect(requestRayTrace).toHaveBeenLastCalledWith(
      expect.objectContaining({ txLat: 51.5, txLon: -0.13 }),
    );
  });

  it('does not request when enabled is false', async () => {
    requestRayTrace.mockResolvedValue([SKY]);
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => usePropagationRayTrace(PARAMS, enabled),
      { initialProps: { enabled: false } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RAY_TRACE_DEBOUNCE_MS);
    });
    expect(requestRayTrace).not.toHaveBeenCalled();
    expect(result.current).toEqual([]);

    rerender({ enabled: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RAY_TRACE_DEBOUNCE_MS);
    });
    expect(requestRayTrace).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual([SKY]);
  });
});
