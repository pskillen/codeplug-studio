import { useEffect, useState } from 'react';
import type { RayPathResult, RayTraceParams } from '@core/domain/hfPropagation/types.ts';
import { rayTraceClient } from '@integrations/hfPropagation/rayTraceClient.ts';

/** Debounce for Worker fetches — 150–300ms, same ballpark as geocode / look-ahead. */
export const RAY_TRACE_DEBOUNCE_MS = 200;

export interface PropagationRayTraceState {
  rays: RayPathResult[];
  isComputing: boolean;
}

/**
 * Debounced ray-trace against the shared Worker client. Ignores stale in-flight results
 * (cancelled effect / newer request). Call once per azimuth — the vertical-slice view
 * invokes this a second time for the slice-plane bearing when it differs from heading.
 *
 * Pass `enabled: false` to skip the Worker (reuse the primary results instead).
 * Previous `rays` stay in place until a newer request resolves — views must not blank.
 */
export function usePropagationRayTrace(
  params: RayTraceParams,
  enabled = true,
): PropagationRayTraceState {
  const [rays, setRays] = useState<RayPathResult[]>([]);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      setPending(true);
      void rayTraceClient
        .requestRayTrace(params)
        .then((result) => {
          if (cancelled) return;
          setRays(result);
          setPending(false);
        })
        .catch(() => {
          if (cancelled) return;
          setRays([]);
          setPending(false);
        });
    }, RAY_TRACE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    enabled,
    params.frequencyMhz,
    params.antenna,
    params.layers,
    params.azimuthDeg,
    params.txLat,
    params.txLon,
    params.atMs,
  ]);

  return { rays, isComputing: enabled && pending };
}
