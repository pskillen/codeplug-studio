import type { Satellite } from '@core/models/satellite.ts';
import { satelliteHasFrequencies } from './satelliteFrequencies.ts';

/** Enabled satellites that pass the TX/RX frequency qualification check. */
export function computeFrequencyQualifiedSatelliteIds(enabledSatellites: Satellite[]): Set<string> {
  const ids = new Set<string>();
  for (const satellite of enabledSatellites) {
    if (satelliteHasFrequencies(satellite.transmitters)) {
      ids.add(satellite.id);
    }
  }
  return ids;
}

/**
 * Satellites the dashboard should show across the pass grid, 2D map, and 3D globe —
 * enabled satellites narrowed by the frequency toggle and optional multi-select filter.
 */
export function computeInterestedSatelliteIds(
  enabledSatelliteIds: Set<string>,
  frequencyQualifiedIds: Set<string>,
  selectedSatelliteIds: Set<string>,
  onlyWithFrequencies: boolean,
): Set<string> {
  let ids = enabledSatelliteIds;
  if (onlyWithFrequencies) {
    ids = new Set([...ids].filter((id) => frequencyQualifiedIds.has(id)));
  }
  if (selectedSatelliteIds.size > 0) {
    ids = new Set([...ids].filter((id) => selectedSatelliteIds.has(id)));
  }
  return ids;
}

/** Whether satellite-level filters narrow the dashboard below all enabled satellites. */
export function hasSatelliteInterestFilter(
  onlyWithFrequencies: boolean,
  selectedSatelliteIds: Set<string>,
): boolean {
  return onlyWithFrequencies || selectedSatelliteIds.size > 0;
}
