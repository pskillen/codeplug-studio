/**
 * DM-32UV radio descriptor — registry entry for Web Serial I/O.
 */

import type { RadioDescriptor } from '../../types.ts';
import { DM32_CONNECTION, DM32_LIMITS, DM32_MODEL_IDS } from './constants.ts';
import {
  extractDm32uvHydration,
  extractDm32uvHydrationFromProtocol,
  mergeChannelsIntoDm32uvHydration,
  DM32UV_MODEL_ID,
} from './hydration.ts';
import { createDm32uvProtocol, Dm32uvProtocol } from './protocol.ts';

export { DM32UV_MODEL_ID };

export const DM32UV_DESCRIPTOR: RadioDescriptor = {
  modelIds: [...DM32_MODEL_IDS],
  label: 'Baofeng DM-32UV',
  group: 'Baofeng',
  supportsBle: false,
  protocolFactory: createDm32uvProtocol,
  capabilities: {
    maxChannels: DM32_LIMITS.CHANNEL_MAX,
    supportsZones: true,
    supportsScanLists: true,
    analogOnly: false,
    supportsBle: false,
    supportsBulkRead: true,
  },
  attributionIds: ['chirp', 'neonplug'],
  compatibleProfiles: [{ formatId: 'radio-io', profileId: 'radio-io-dm32uv' }],
  writeStrategy: 'selective-ranges',
  hydrationRequiredForWrite: true,
  baudRate: DM32_CONNECTION.BAUD_RATE,
  hydration: {
    extractHydration: (image, meta) => {
      const proto = meta?.protocol;
      if (proto instanceof Dm32uvProtocol) {
        const cache = proto.getDownloadCache();
        if (cache && cache.blocks.size > 0) {
          return extractDm32uvHydrationFromProtocol(image, cache, meta);
        }
      }
      return extractDm32uvHydration(image, meta);
    },
    mergeChannelsIntoHydration: mergeChannelsIntoDm32uvHydration,
  },
};
