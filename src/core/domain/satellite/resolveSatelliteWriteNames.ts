import type { BuildEntityOverride } from '@core/models/radioBuild.ts';
import type { Satellite } from '@core/models/satellite.ts';
import { overrideByEntityId } from '@core/domain/formatBuildOverrides.ts';
import { shortenSatelliteNames, type ShortenSatelliteNameResult } from './shortenSatelliteNames.ts';

export interface ResolveSatelliteWriteNamesOptions {
  maxLength: number;
}

/**
 * Resolve distinct wire names for the satellites in a write set, honouring build overrides.
 */
export function resolveSatelliteWriteNames(
  satellites: readonly Satellite[],
  satelliteOverrides: readonly BuildEntityOverride[] | undefined,
  options: ResolveSatelliteWriteNamesOptions,
): Map<string, ShortenSatelliteNameResult> {
  const overrides = overrideByEntityId(satelliteOverrides);
  const inputs = satellites.map((satellite) => ({
    id: satellite.id,
    name: satellite.name,
    noradId: satellite.noradId,
    wireNameOverride: overrides.get(satellite.id)?.wireName,
  }));
  return shortenSatelliteNames(inputs, { maxLength: options.maxLength });
}
