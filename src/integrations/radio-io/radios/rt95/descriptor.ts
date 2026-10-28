/**
 * RT95 VOX radio descriptor — registry entry for Web Serial I/O.
 */

import type { RadioDescriptor } from '../../types.ts';
import { RT95_BAUD_RATE, RT95_CHANNEL_COUNT, RT95_MODEL_ID } from './constants.ts';
import { extractRt95Hydration, mergeChannelsIntoRt95Hydration } from './hydration.ts';
import { createRt95Protocol, Rt95Protocol } from './protocol.ts';
import { rt95ModDataIntentFromOrganisation } from './modDataIntent.ts';
import { RT95_WRITE_VERIFY_HOOKS } from './writeVerifyHooks.ts';
import { planRt95Stages } from './plannedStages.ts';

export const RT95_DESCRIPTOR: RadioDescriptor = {
  modelIds: [RT95_MODEL_ID, 'RT95-P', 'Retevis RT95 VOX'],
  label: 'Retevis RT95 VOX',
  group: 'Retevis',
  supportsBle: false,
  protocolFactory: createRt95Protocol,
  capabilities: {
    maxChannels: RT95_CHANNEL_COUNT,
    supportsZones: false,
    supportsScanLists: false,
    analogOnly: true,
    supportsBulkRead: true,
  },
  attributionIds: ['chirp'],
  compatibleProfiles: [
    { formatId: 'radio-io', profileId: 'radio-io-rt95' },
    // Hidden on prod until the owner has checked the MM9PDY firmware on a radio.
    { formatId: 'radio-io', profileId: 'radio-io-rt95-mm9pdy', prodWriteDisabled: true },
  ],
  writeStrategy: 'full-image',
  baudRate: RT95_BAUD_RATE,
  hydration: {
    extractHydration: extractRt95Hydration,
    mergeChannelsIntoHydration: mergeChannelsIntoRt95Hydration,
    seedProtocolForUpload(protocol, _bag, organisation, channels) {
      if (protocol instanceof Rt95Protocol) {
        protocol.setModDataIntent(rt95ModDataIntentFromOrganisation(organisation, channels));
      }
    },
  },
  writeVerify: RT95_WRITE_VERIFY_HOOKS,
  planStages: planRt95Stages,
};
