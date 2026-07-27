/**
 * TYT MD-9600 / Retevis RT-90 OpenGD77 radio descriptor.
 */

import type { RadioDescriptor, RadioHydrationHooks } from '../../../types.ts';
import {
  OPENGD77_BAUD_RATE,
  OPENGD77_CHANNEL_SLOTS,
  OPENGD77_MD9600_POWER_STEPS,
} from '../constants.ts';
import {
  extractOpenGd77Hydration,
  mergeChannelsIntoOpenGd77Hydration,
  memoryMapFromOpenGd77Hydration,
  OPENGD77_MD9600_MODEL_ID,
} from '../hydration.ts';
import { createOpenGd77Md9600Protocol, OpenGd77Protocol } from '../protocol.ts';

export { OPENGD77_MD9600_MODEL_ID };

const hydration: RadioHydrationHooks = {
  extractHydration: (image, meta) => {
    const proto = meta?.protocol;
    const firmware =
      proto instanceof OpenGd77Protocol
        ? (proto.getFirmwareInfo()?.fwRevision ?? undefined)
        : undefined;
    return extractOpenGd77Hydration(image, {
      sourceFileName: meta?.sourceFileName,
      capturedAt: meta?.capturedAt,
      firmware,
      radioModelId: OPENGD77_MD9600_MODEL_ID,
    });
  },
  mergeChannelsIntoHydration: (bag, channels, organisation) =>
    mergeChannelsIntoOpenGd77Hydration(bag, channels, organisation, {
      powerSteps: OPENGD77_MD9600_POWER_STEPS,
    }),
  seedProtocolForUpload: (protocol, bag) => {
    if (protocol instanceof OpenGd77Protocol) {
      protocol.seedPriorImage(memoryMapFromOpenGd77Hydration(bag));
    }
  },
};

export const OPENGD77_MD9600_DESCRIPTOR: RadioDescriptor = {
  modelIds: [OPENGD77_MD9600_MODEL_ID, 'MD-9600', 'RT-90', 'TYT MD-9600', 'Retevis RT-90'],
  label: 'TYT MD-9600 / RT-90 (OpenGD77)',
  group: 'TYT',
  supportsBle: false,
  protocolFactory: createOpenGd77Md9600Protocol,
  capabilities: {
    maxChannels: OPENGD77_CHANNEL_SLOTS - 1,
    supportsZones: true,
    supportsScanLists: false,
    analogOnly: false,
    supportsBle: false,
    supportsBulkRead: true,
  },
  attributionIds: ['qdmr'],
  compatibleProfiles: [{ formatId: 'radio-io', profileId: 'radio-io-opengd77-md9600' }],
  writeStrategy: 'full-image',
  hydrationRequiredForWrite: true,
  baudRate: OPENGD77_BAUD_RATE,
  hydration,
};
