/**
 * UV-5R Mini radio descriptor — registry entry for Web Serial I/O.
 */

import type { RadioDescriptor } from '../../types.ts';
import {
  UV5R_MINI_BAUD_RATE,
  UV5R_MINI_BAUD_RATE_FALLBACK,
  UV5R_MINI_CHANNEL_COUNT,
} from './constants.ts';
import {
  extractUv5rMiniHydration,
  mergeChannelsIntoUv5rMiniHydration,
  UV5R_MINI_MODEL_ID,
} from './hydration.ts';
import { createUv5rMiniProtocol, Uv5rMiniProtocol } from './protocol.ts';
import { createUv17ProWriteVerifyHooks } from '../uv17pro-family/writeVerifyHooks.ts';
import { UV5R_MINI_LAYOUT } from '../uv17pro-family/layout.ts';
import { uv5rMiniZoneIntentFromOrganisation } from './modDataIntent.ts';
import { planUv5rMiniStages } from './plannedStages.ts';
import { MMZ1_BASE, MMZ1_END } from './modData/index.ts';

export { UV5R_MINI_MODEL_ID };

export const UV5R_MINI_DESCRIPTOR: RadioDescriptor = {
  modelIds: [UV5R_MINI_MODEL_ID, 'UV-5R Mini'],
  label: 'Baofeng UV-5R Mini',
  group: 'Baofeng',
  supportsBle: true, // NeonPlug supports BLE; Studio BLE pipe deferred
  protocolFactory: createUv5rMiniProtocol,
  capabilities: {
    maxChannels: UV5R_MINI_CHANNEL_COUNT,
    supportsZones: false,
    supportsScanLists: false,
    analogOnly: true,
    supportsBle: true,
    supportsBulkRead: true,
  },
  attributionIds: ['chirp', 'neonplug'],
  compatibleProfiles: [
    { formatId: 'radio-io', profileId: 'radio-io-uv5r-mini' },
    { formatId: 'radio-io', profileId: 'radio-io-uv5r-mini-mm9pdy' },
  ],
  writeStrategy: 'full-image',
  baudRate: UV5R_MINI_BAUD_RATE,
  baudRateFallback: UV5R_MINI_BAUD_RATE_FALLBACK,
  // The radio ends its clone session about 2 s after the last byte (decoded from the firmware, not yet seen on a
  // radio) and returns to its idle screen. A longer Review reconnects and re-reads, so the Write encodes over what
  // the radio holds now. The protocol's own idle check (`sessionIdleMs`) covers Restore and any other gap.
  programHoldSafeMs: 1500,
  hydration: {
    extractHydration: extractUv5rMiniHydration,
    mergeChannelsIntoHydration: mergeChannelsIntoUv5rMiniHydration,
    // Every Write re-seeds: a stock projection clears the intent and the write profile goes back to stock.
    seedProtocolForUpload(protocol, _bag, organisation) {
      if (protocol instanceof Uv5rMiniProtocol) {
        protocol.setZoneIntent(uv5rMiniZoneIntentFromOrganisation(organisation));
      }
    },
  },
  writeVerify: createUv17ProWriteVerifyHooks(UV5R_MINI_LAYOUT, {
    extraSpan: { id: 'mm9pdy-zone-table', label: 'Zone table', start: MMZ1_BASE, end: MMZ1_END },
  }),
  planStages: planUv5rMiniStages,
};
