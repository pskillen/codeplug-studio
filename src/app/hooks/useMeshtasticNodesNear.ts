import { useEffect, useMemo, useState } from 'react';
import type { GeoPoint } from '@core/models/libraryTypes.ts';
import {
  MESHFLOW_MAX_RADIUS_KM,
  meshflowRequestRadiusKm,
  searchMeshtasticInfrastructureNear,
  type MeshtasticInfrastructureNode,
} from '@integrations/meshflow/index.ts';

export interface MeshtasticNodesNear {
  nodes: MeshtasticInfrastructureNode[];
  loading: boolean;
  error: string | null;
  /** Meshflow capped the result list. */
  truncated: boolean;
  /** The chosen radius is above what Meshflow searches. */
  radiusCapped: boolean;
}

const EMPTY: MeshtasticInfrastructureNode[] = [];

/**
 * Meshtastic routers and repeaters around a point (Meshflow). Only fetches when enabled. The
 * request point is rounded in the client; exact radius filtering and ranking happen in the caller.
 */
export function useMeshtasticNodesNear(
  point: GeoPoint | null,
  radiusM: number,
  enabled: boolean,
): MeshtasticNodesNear {
  const radiusKm = radiusM / 1000;
  const key = useMemo(
    () =>
      enabled && point
        ? `${point.lat.toFixed(2)},${point.lon.toFixed(2)},${meshflowRequestRadiusKm(radiusKm)}`
        : '',
    [enabled, point, radiusKm],
  );
  const [result, setResult] = useState<{
    key: string;
    nodes: MeshtasticInfrastructureNode[];
    truncated: boolean;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const [lat, lon] = key.split(',').map(Number);
    searchMeshtasticInfrastructureNear({ lat, lon, radiusKm })
      .then((r) => {
        if (!cancelled) setResult({ key, nodes: r.nodes, truncated: r.truncated, error: null });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setResult({
          key,
          nodes: EMPTY,
          truncated: false,
          error: e instanceof Error ? e.message : 'Meshflow request failed',
        });
      });
    return () => {
      cancelled = true;
    };
    // radiusKm is captured in `key` (via the request radius).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = result && result.key === key ? result : null;
  return {
    nodes: current?.nodes ?? EMPTY,
    loading: key !== '' && current == null,
    error: current?.error ?? null,
    truncated: key !== '' && (current?.truncated ?? false),
    radiusCapped: enabled && radiusKm > MESHFLOW_MAX_RADIUS_KM,
  };
}
