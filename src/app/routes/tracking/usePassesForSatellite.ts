import { useEffect, useState } from 'react';
import type {
  ObserverLocation,
  PassPredictionWindow,
  PassResult,
} from '@core/domain/satelliteTracking/types.ts';
import { passPredictionClient } from '@integrations/satelliteTracking/passPredictionClient.ts';
import { useTrackingSettings } from '../../state/useTrackingSettings.ts';

/** Sweep resolution shared by every pass-prediction Worker call in the tracking dashboard. */
export const PASS_PREDICTION_STEP_MINUTES = 1;
/** Debounce shared by every pass-prediction hook so rapid input changes don't spam the Worker. */
export const PASS_PREDICTION_DEBOUNCE_MS = 300;

/** Minimal shape needed to request passes for a satellite — TLE lines only. */
export interface SatelliteTleRef {
  tleLine1: string;
  tleLine2: string;
}

export interface PassWindow {
  /** ISO 8601 window start. */
  fromAt: string;
  /** ISO 8601 window end. */
  toAt: string;
}

export interface UsePassesForSatelliteResult {
  passes: PassResult[];
  loading: boolean;
  error: string | null;
  hasObserver: boolean;
}

/**
 * Requests passes for one satellite (TLE pair) via the shared pass-prediction Web Worker.
 * Thin wrapper around `passPredictionClient` — the single point both `usePassesForSatellite`
 * (below) and `useTrackingPasses` (the multi-satellite pass grid) call, so the two hooks share
 * Worker-call plumbing instead of duplicating it.
 */
export function requestSatellitePasses(
  tleLine1: string,
  tleLine2: string,
  observer: ObserverLocation,
  window: PassPredictionWindow,
): Promise<PassResult[]> {
  return passPredictionClient.requestPasses(tleLine1, tleLine2, observer, {
    stepMinutes: PASS_PREDICTION_STEP_MINUTES,
    ...window,
  });
}

/**
 * Passes for a single satellite over an explicit `[fromAt, toAt)` window — the building block
 * behind the satellite detail page's future/past pass lists. `useTrackingPasses` composes the
 * same `requestSatellitePasses` call across every enabled satellite for the pass grid instead
 * of using this hook directly (calling a hook inside a loop isn't valid), but the Worker-call
 * logic itself is shared.
 */
export function usePassesForSatellite(
  satellite: SatelliteTleRef | null,
  window: PassWindow,
): UsePassesForSatelliteResult {
  const { settings } = useTrackingSettings();
  const [passes, setPasses] = useState<PassResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const observerLocation = settings?.location ?? null;
  const tleLine1 = satellite?.tleLine1 ?? null;
  const tleLine2 = satellite?.tleLine2 ?? null;

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(() => {
      const run = async () => {
        if (!tleLine1 || !tleLine2 || !observerLocation) {
          if (!cancelled) {
            setPasses([]);
            setError(null);
          }
          return;
        }

        setLoading(true);
        setError(null);
        try {
          const results = await requestSatellitePasses(
            tleLine1,
            tleLine2,
            { latDeg: observerLocation.lat, lonDeg: observerLocation.lon },
            { fromAt: window.fromAt, toAt: window.toAt },
          );
          if (!cancelled) setPasses(results);
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : 'Failed to compute satellite passes.');
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      void run();
    }, PASS_PREDICTION_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tleLine1, tleLine2, observerLocation, window.fromAt, window.toAt]);

  return { passes, loading, error, hasObserver: observerLocation !== null };
}
