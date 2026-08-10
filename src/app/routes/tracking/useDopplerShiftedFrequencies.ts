import { useMemo } from 'react';
import { computeDopplerFactor } from '@core/domain/satelliteTracking/dopplerShift.ts';
import type { ObserverLocation } from '@core/domain/satelliteTracking/types.ts';

export interface DopplerShiftedFrequencies {
  uplinkHz: number | null;
  downlinkHz: number | null;
}

const NULL_RESULT: DopplerShiftedFrequencies = { uplinkHz: null, downlinkHz: null };

/**
 * Doppler-corrected uplink/downlink for the current instant, recomputed only while `isActive`
 * (a pass is currently above horizon) — skips the propagation call entirely otherwise, same
 * "don't recompute unless something is actually live" convention as `useLiveSatellitePosition`.
 * `nowMs` should come from a shared tick (`useNowTick`) rather than this hook running its own
 * timer.
 */
export function useDopplerShiftedFrequencies(
  satellite: { tleLine1: string; tleLine2: string } | null,
  uplinkHz: number | null | undefined,
  downlinkHz: number | null | undefined,
  observer: ObserverLocation | null,
  isActive: boolean,
  nowMs: number,
): DopplerShiftedFrequencies {
  return useMemo(() => {
    if (!isActive || !satellite || !observer) return NULL_RESULT;

    const factor = computeDopplerFactor(
      satellite.tleLine1,
      satellite.tleLine2,
      observer,
      new Date(nowMs).toISOString(),
    );
    if (factor === null) return NULL_RESULT;

    return {
      uplinkHz: uplinkHz != null ? uplinkHz * factor : null,
      downlinkHz: downlinkHz != null ? downlinkHz * factor : null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- satellite/observer identity churns every render; the primitive fields below are the real deps
  }, [
    isActive,
    satellite?.tleLine1,
    satellite?.tleLine2,
    uplinkHz,
    downlinkHz,
    observer?.latDeg,
    observer?.lonDeg,
    observer?.heightKm,
    nowMs,
  ]);
}
