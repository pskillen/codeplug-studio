/**
 * Deploy-specific facts for the landing-page support matrix (#1494). Core derives the matrix from the radio
 * catalog; this adapter answers the questions only the integrations layer and the build env can: does a radio-io
 * descriptor exist for the egress (Read), is cable Write offered on this site, is the flasher offered here.
 */
import { listDescriptorsForProfile } from '@integrations/radio-io';
import type { SupportMatrixAvailability } from '@core/radio-targets/index.ts';

import { listOfferedFirmwareUpdaters } from './firmwareFlashEnvGate.ts';
import { hasSatelliteKepsWriteAdapter } from './satelliteKepsWriteAdapters.ts';
import { resolveRadioWriteGate } from './radioWriteEnvGate.ts';

export function supportMatrixAvailability(buildEnv?: string): SupportMatrixAvailability {
  const offered = new Set(listOfferedFirmwareUpdaters(buildEnv).map((d) => d.radioId));
  const cableWrite = (e: Parameters<NonNullable<SupportMatrixAvailability['cableWrite']>>[0]) =>
    listDescriptorsForProfile(e.formatId, e.profileId).some(
      (d) => resolveRadioWriteGate(d, buildEnv, e.profileId) === 'allowed',
    );
  return {
    cableRead: (e) => listDescriptorsForProfile(e.formatId, e.profileId).length > 0,
    cableWrite,
    satelliteKeps: (e) => hasSatelliteKepsWriteAdapter(e.profileId) && cableWrite(e),
    firmwareFlash: (radioId) => offered.has(radioId),
  };
}
