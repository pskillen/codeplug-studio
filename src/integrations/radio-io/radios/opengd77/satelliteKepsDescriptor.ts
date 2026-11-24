import { OPENGD77_FAMILY_LIMITS } from '@core/radios/opengd77/limits.ts';
import type { SatelliteKepsCapability } from '../../satelliteKepsCapability.ts';
import {
  listCapabilitySkippedTransmitters,
  previewSatelliteWriteRecords,
  skippedSatellites,
} from './satelliteCodec.ts';

function openGd77Exclusions(
  satellites: Parameters<SatelliteKepsCapability['exclusions']>[0],
  options?: Parameters<SatelliteKepsCapability['exclusions']>[1],
): ReturnType<SatelliteKepsCapability['exclusions']> {
  return [
    ...skippedSatellites(satellites).map((s) => ({
      satelliteId: s.satelliteId,
      transmitterId: null,
      reason: s.reason,
    })),
    ...listCapabilitySkippedTransmitters(satellites, options?.satelliteOverrides).map((t) => ({
      satelliteId: t.satelliteId,
      transmitterId: t.transmitterId,
      reason: t.reason,
    })),
  ];
}

export const OPENGD77_SATELLITE_KEPS_CAPABILITY: SatelliteKepsCapability = {
  limits: {
    max: OPENGD77_FAMILY_LIMITS.SATELLITE_MAX,
    nameLength: OPENGD77_FAMILY_LIMITS.SATELLITE_NAME_LENGTH,
    unitNoun: 'satellite',
    nameScope: 'spacecraft',
    limitsDoc: 'docs/reference/radios/opengd77/satellite-orbitals.md',
  },
  preview: (satellites, options) =>
    previewSatelliteWriteRecords(satellites, {
      satelliteOverrides: options?.satelliteOverrides,
    }),
  exclusions: openGd77Exclusions,
};