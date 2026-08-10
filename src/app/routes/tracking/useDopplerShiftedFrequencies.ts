import { useMemo } from 'react';
import { computeDopplerFactor } from '@core/domain/satelliteTracking/dopplerShift.ts';
import type { ObserverLocation } from '@core/domain/satelliteTracking/types.ts';

export interface DopplerShiftedTransmitter {
  id: string;
  uplinkHz: number | null;
  downlinkHz: number | null;
}

/**
 * Doppler-corrected uplink/downlink per transmitter for the current instant, recomputed only
 * while `isActive` (a pass is currently above horizon) — skips the propagation call entirely
 * otherwise, same "don't recompute unless something is actually live" convention as
 * `useLiveSatellitePosition`. `nowMs` should come from a shared tick (`useNowTick`) rather than
 * this hook running its own timer. One Doppler factor is computed per call and applied to every
 * transmitter — the factor depends only on the observer/satellite geometry at `nowMs`, not on
 * which frequency it's applied to.
 */
export function useDopplerShiftedFrequencies(
  satellite: { tleLine1: string; tleLine2: string } | null,
  transmitters: { id: string; uplinkHz: number | null; downlinkHz: number | null }[],
  observer: ObserverLocation | null,
  isActive: boolean,
  nowMs: number,
): DopplerShiftedTransmitter[] {
  return useMemo(() => {
    if (!isActive || !satellite || !observer) {
      return transmitters.map((t) => ({ id: t.id, uplinkHz: null, downlinkHz: null }));
    }

    const factor = computeDopplerFactor(
      satellite.tleLine1,
      satellite.tleLine2,
      observer,
      new Date(nowMs).toISOString(),
    );
    if (factor === null) {
      return transmitters.map((t) => ({ id: t.id, uplinkHz: null, downlinkHz: null }));
    }

    return transmitters.map((t) => ({
      id: t.id,
      uplinkHz: t.uplinkHz != null ? t.uplinkHz * factor : null,
      downlinkHz: t.downlinkHz != null ? t.downlinkHz * factor : null,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- same rationale as before: satellite/transmitters identity churns every render, primitive-derived deps below are the real ones
  }, [
    isActive,
    satellite?.tleLine1,
    satellite?.tleLine2,
    transmitters,
    observer?.latDeg,
    observer?.lonDeg,
    observer?.heightKm,
    nowMs,
  ]);
}
