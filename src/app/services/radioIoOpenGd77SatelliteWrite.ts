/**
 * Write satellite keps to OpenGD77 (DM-1701 / MD-9600) over Web Serial (#858).
 */

import type { BuildEntityOverride } from '@core/models/radioBuild.ts';
import type { Satellite } from '@core/models/satellite.ts';
import { OPENGD77_FAMILY_LIMITS } from '@core/radios/opengd77/limits.ts';
import { OpenGd77Protocol } from '@integrations/radio-io/radios/opengd77/protocol.ts';
import {
  countWriteEligibleSatelliteRecords,
  listCapabilitySkippedTransmitters,
  packSatelliteBank,
  skippedSatellites,
} from '@integrations/radio-io/radios/opengd77/satelliteCodec.ts';
import { uploadOpenGd77SatelliteBank } from '@integrations/radio-io/radios/opengd77/satelliteWrite.ts';
import type { ProgressFn, RadioSession } from '@integrations/radio-io/index.ts';
import { RadioWriteBlockedError } from './radioIoSession.ts';

export interface WriteOpenGd77SatellitesToRadioResult {
  written: number;
  skipped: { satelliteId: string; reason: string }[];
  skippedTransmitters: ReturnType<typeof listCapabilitySkippedTransmitters>;
}

export { countWriteEligibleSatelliteRecords, skippedSatellites, listCapabilitySkippedTransmitters };

export async function writeOpenGd77SatellitesToRadio(
  session: RadioSession,
  satellites: readonly Satellite[],
  opts?: {
    onProgress?: ProgressFn;
    signal?: AbortSignal;
    satelliteOverrides?: readonly BuildEntityOverride[];
  },
): Promise<WriteOpenGd77SatellitesToRadioResult> {
  const selected = countWriteEligibleSatelliteRecords(satellites);
  if (selected > OPENGD77_FAMILY_LIMITS.SATELLITE_MAX) {
    const radioLabel = session.descriptor.label;
    throw new RadioWriteBlockedError(
      `You have selected ${selected} satellites, but the ${radioLabel} only supports ` +
        `${OPENGD77_FAMILY_LIMITS.SATELLITE_MAX} (see docs/reference/radios/opengd77/satellite-orbitals.md). ` +
        `Please deselect some satellites in the library.`,
      { selected, max: OPENGD77_FAMILY_LIMITS.SATELLITE_MAX, radioLabel },
    );
  }

  if (!(session.radio instanceof OpenGd77Protocol)) {
    throw new Error('OpenGD77 satellite write requires an OpenGD77 radio session.');
  }

  const bank = packSatelliteBank(satellites, {
    satelliteOverrides: opts?.satelliteOverrides,
  });
  await uploadOpenGd77SatelliteBank(session.radio, bank, {
    onProgress: opts?.onProgress,
    signal: opts?.signal,
  });

  return {
    written: selected,
    skipped: skippedSatellites(satellites),
    skippedTransmitters: listCapabilitySkippedTransmitters(satellites),
  };
}
