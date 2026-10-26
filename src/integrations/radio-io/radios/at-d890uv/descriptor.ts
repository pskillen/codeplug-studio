/**
 * AT-D890UV radio descriptor — registry entry for Web Serial I/O.
 */

import type { RadioDescriptor } from '../../types.ts';
import { AT_D890_CONNECTION, AT_D890_LIMITS, AT_D890UV_MODEL_IDS } from './constants.ts';
import {
  extractAtD890uvHydration,
  extractAtD890uvHydrationFromProtocol,
  mergeChannelsIntoAtD890uvHydration,
  AT_D890UV_MODEL_ID,
} from './hydration.ts';
import { atD890UploadBankIntentFromOrganisation } from './memory.ts';
import { createAtD890uvProtocol, AtD890uvProtocol } from './protocol.ts';
import { AT_D890_WRITE_VERIFY_HOOKS } from './writeVerifyHooks.ts';
import { planAtD890Stages } from './plannedStages.ts';

export { AT_D890UV_MODEL_ID };

export const AT_D890UV_DESCRIPTOR: RadioDescriptor = {
  modelIds: [...AT_D890UV_MODEL_IDS],
  label: 'Anytone AT-D890UV',
  group: 'Anytone',
  supportsBle: false,
  protocolFactory: createAtD890uvProtocol,
  capabilities: {
    maxChannels: AT_D890_LIMITS.MAX_CHANNELS,
    supportsZones: true,
    supportsScanLists: true,
    analogOnly: false,
    supportsBle: false,
    supportsBulkRead: true,
  },
  attributionIds: ['anytone-cps'],
  compatibleProfiles: [
    { formatId: 'radio-io', profileId: 'radio-io-at-d890uv' },
    { formatId: 'radio-io', profileId: 'radio-io-at-d890uv-mm9pdy' },
  ],
  writeStrategy: 'selective-ranges',
  // The PC-mode loop has no exit of its own (static read of the stock firmware; radio check RS14).
  programHoldSafeMs: Number.POSITIVE_INFINITY,
  baudRate: AT_D890_CONNECTION.BAUD_RATE,
  hydration: {
    extractHydration: (image, meta) => {
      const proto = meta?.protocol;
      if (proto instanceof AtD890uvProtocol) {
        const cache = proto.getDownloadCache();
        if (cache && cache.blocks.size > 0) {
          return extractAtD890uvHydrationFromProtocol(image, cache, meta);
        }
      }
      return extractAtD890uvHydration(image, meta);
    },
    mergeChannelsIntoHydration: mergeChannelsIntoAtD890uvHydration,
    seedProtocolForUpload: (protocol, _bag, organisation, channels) => {
      if (protocol instanceof AtD890uvProtocol) {
        protocol.setUploadBankIntent(
          atD890UploadBankIntentFromOrganisation(organisation, channels),
        );
      }
    },
  },
  writeVerify: AT_D890_WRITE_VERIFY_HOOKS,
  planStages: planAtD890Stages,
};
