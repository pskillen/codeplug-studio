/**
 * UV-5R Mini radio descriptor — registry entry for Web Serial I/O.
 */

import type { RadioDescriptor } from '../../types.ts';
import { UV5R_MINI_BAUD_RATE, UV5R_MINI_CHANNEL_COUNT } from './constants.ts';
import {
  extractUv5rMiniHydration,
  mergeChannelsIntoUv5rMiniHydration,
  UV5R_MINI_MODEL_ID,
} from './hydration.ts';
import { createUv5rMiniProtocol } from './protocol.ts';

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
  compatibleProfiles: [{ formatId: 'radio-io', profileId: 'radio-io-uv5r-mini' }],
  writeStrategy: 'full-image',
  hydrationRequiredForWrite: true,
  baudRate: UV5R_MINI_BAUD_RATE,
  hydration: {
    extractHydration: extractUv5rMiniHydration,
    mergeChannelsIntoHydration: mergeChannelsIntoUv5rMiniHydration,
  },
};
