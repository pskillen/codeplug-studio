import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import type { SatelliteKepsCapability } from '../../satelliteKepsCapability.ts';
import {
  listCapabilitySkippedTransmitters,
  previewSatelliteWriteRecords,
  skippedSatellites,
} from './index.ts';

const atD890Exclusions: SatelliteKepsCapability['exclusions'] = (satellites, options) => [
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

export const AT_D890UV_SATELLITE_KEPS_CAPABILITY: SatelliteKepsCapability = {
  limits: {
    max: AT_D890UV_LIMITS.SATELLITE_MAX,
    nameLength: AT_D890UV_LIMITS.SATELLITE_NAME_LENGTH,
    unitNoun: 'transmitter',
    nameScope: 'transmitter',
    limitsDoc: 'docs/reference/radios/anytone/at-d890uv/satellite-keps.md',
  },
  preview: (satellites, options) =>
    previewSatelliteWriteRecords(satellites, {
      satelliteOverrides: options?.satelliteOverrides,
    }),
  exclusions: atD890Exclusions,
};