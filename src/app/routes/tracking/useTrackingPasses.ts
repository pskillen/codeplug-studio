import { useEffect, useMemo, useState } from 'react';
import type { PassResult } from '@core/domain/satelliteTracking/types.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { useTrackingSettings } from '../../state/useTrackingSettings.ts';
import { PASS_PREDICTION_DEBOUNCE_MS, requestSatellitePasses } from './usePassesForSatellite.ts';

/** Pass prediction row before SatNOGS enrichment is merged for grid display/filtering. */
export interface SatellitePassBaseRow extends PassResult {
  satelliteId: string;
  satelliteName: string;
  noradId: number;
  tleLine1: string;
  tleLine2: string;
  satelliteUplinkHz: number | null;
  satelliteDownlinkHz: number | null;
}

export interface SatellitePassRow extends SatellitePassBaseRow {
  hasFrequencies: boolean;
  txDisplay: string;
  rxDisplay: string;
  txSortHz: number | null;
  rxSortHz: number | null;
}

export interface UseTrackingPassesResult {
  passes: SatellitePassBaseRow[];
  loading: boolean;
  error: string | null;
  hasObserver: boolean;
  hasEnabledSatellites: boolean;
}

export const DEFAULT_WINDOW_HOURS = 12;

/**
 * Upcoming passes for every enabled satellite in the project library, over a
 * caller-supplied look-ahead window (hours from now). Defaults to
 * `DEFAULT_WINDOW_HOURS` (12h) when omitted.
 */
export function useTrackingPasses(
  windowHours: number = DEFAULT_WINDOW_HOURS,
): UseTrackingPassesResult {
  const { library } = useLibrary();
  const { settings } = useTrackingSettings();
  const [passes, setPasses] = useState<SatellitePassBaseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabledSatellites = useMemo(
    () => library.satellites.filter((satellite) => satellite.enabled),
    [library.satellites],
  );
  const observerLocation = settings?.location ?? null;

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(() => {
      const run = async () => {
        if (!observerLocation || enabledSatellites.length === 0) {
          if (!cancelled) {
            setPasses([]);
            setError(null);
          }
          return;
        }

        setLoading(true);
        setError(null);
        const fromAt = new Date().toISOString();
        const toAt = new Date(Date.now() + windowHours * 60 * 60 * 1000).toISOString();
        const observer = { latDeg: observerLocation.lat, lonDeg: observerLocation.lon };

        try {
          const perSatellite = await Promise.all(
            enabledSatellites.map(async (satellite) => {
              const results = await requestSatellitePasses(
                satellite.tleLine1,
                satellite.tleLine2,
                observer,
                { fromAt, toAt },
              );
              return results.map((result) => ({
                ...result,
                satelliteId: satellite.id,
                satelliteName: satellite.name,
                noradId: satellite.noradId,
                tleLine1: satellite.tleLine1,
                tleLine2: satellite.tleLine2,
                satelliteUplinkHz: satellite.uplinkHz ?? null,
                satelliteDownlinkHz: satellite.downlinkHz ?? null,
              }));
            }),
          );
          if (cancelled) return;
          setPasses(perSatellite.flat().sort((a, b) => a.aosAt.localeCompare(b.aosAt)));
        } catch (err) {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : 'Failed to compute satellite passes.');
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
  }, [enabledSatellites, observerLocation, windowHours]);

  return {
    passes,
    loading,
    error,
    hasObserver: observerLocation !== null,
    hasEnabledSatellites: enabledSatellites.length > 0,
  };
}
