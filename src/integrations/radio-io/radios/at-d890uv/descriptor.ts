/**
 * AT-D890UV radio descriptor — registry entry for Web Serial I/O.
 */

import type { RadioDescriptor } from '../../types.ts';
import { AT_D890_CONNECTION, AT_D890_LIMITS, AT_D890UV_MODEL_IDS } from './constants.ts';
import {
  cacheFromBag,
  extractAtD890uvHydration,
  extractAtD890uvHydrationFromProtocol,
  mergeChannelsIntoAtD890uvHydration,
  AT_D890UV_MODEL_ID,
} from './hydration.ts';
import { createAtD890uvProtocol, AtD890uvProtocol } from './protocol.ts';

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
  compatibleProfiles: [{ formatId: 'radio-io', profileId: 'radio-io-at-d890uv' }],
  writeStrategy: 'selective-ranges',
  hydrationRequiredForWrite: true,
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
    seedProtocolForUpload: (protocol, bag) => {
      if (protocol instanceof AtD890uvProtocol) {
        protocol.seedDownloadCache(cacheFromBag(bag));
      }
    },
  },
};
