import { RADIOFOUNDRY_LIMITS, type RadioFoundryBand } from '@core/radios/radiofoundry/limits.ts';
import type { SatelliteKepsCapability } from '../../satelliteKepsCapability.ts';
import {
  previewRadioFoundrySatelliteWriteRecords,
  radioFoundrySkippedSatellites,
  radioFoundrySkippedTransmitters,
} from './satelliteCodec.ts';

/** Keps on one RadioFoundry board: the shared limits, eligibility in that board's bands. */
export function radioFoundrySatelliteKepsCapability(
  bands: readonly RadioFoundryBand[],
): SatelliteKepsCapability {
  return {
    limits: {
      max: RADIOFOUNDRY_LIMITS.SATELLITE_MAX,
      nameLength: RADIOFOUNDRY_LIMITS.SATELLITE_NAME_MAX_BYTES,
      unitNoun: 'satellite',
      nameScope: 'spacecraft',
      limitsDoc: 'docs/reference/radios/radiofoundry/satellite-keps.md',
    },
    preview: (satellites, options) =>
      previewRadioFoundrySatelliteWriteRecords(satellites, {
        bands,
        satelliteOverrides: options?.satelliteOverrides,
      }),
    exclusions: (satellites, options) => {
      const opts = { bands, satelliteOverrides: options?.satelliteOverrides };
      return [
        ...radioFoundrySkippedSatellites(satellites, opts).map((s) => ({
          satelliteId: s.satelliteId,
          transmitterId: null,
          reason: s.reason,
        })),
        ...radioFoundrySkippedTransmitters(satellites, opts),
      ];
    },
  };
}
