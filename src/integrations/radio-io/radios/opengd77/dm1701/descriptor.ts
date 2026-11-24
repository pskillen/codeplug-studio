/**
 * Baofeng DM-1701 / RT-84 OpenGD77 radio descriptor.
 */

import { OPENGD77_FAMILY_LIMITS } from '@core/radios/opengd77/limits.ts';
import type { RadioDescriptor, RadioHydrationHooks } from '../../../types.ts';
import {
  OPENGD77_BAUD_RATE,
  OPENGD77_CHANNEL_SLOTS,
  OPENGD77_RESTART_AFTER_END_SECONDS,
} from '../constants.ts';
import {
  extractOpenGd77Hydration,
  mergeChannelsIntoOpenGd77Hydration,
  OPENGD77_DM1701_MODEL_ID,
} from '../hydration.ts';
import { createOpenGd77Dm1701Protocol, OpenGd77Protocol } from '../protocol.ts';
import { createOpenGd77WriteVerifyHooks } from '../writeVerifyHooks.ts';
import { planOpenGd77Stages } from '../plannedStages.ts';
import { OPENGD77_SATELLITE_KEPS_CAPABILITY } from '../satelliteKepsDescriptor.ts';

export { OPENGD77_DM1701_MODEL_ID };

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
    });
  },
  mergeChannelsIntoHydration: mergeChannelsIntoOpenGd77Hydration,
};

export const OPENGD77_DM1701_DESCRIPTOR: RadioDescriptor = {
  modelIds: [OPENGD77_DM1701_MODEL_ID, 'DM-1701', 'RT-84', 'Baofeng DM-1701', 'Retevis RT-84'],
  label: 'Baofeng DM-1701 / RT-84 (OpenGD77)',
  group: 'Baofeng',
  supportsBle: false,
  protocolFactory: createOpenGd77Dm1701Protocol,
  capabilities: {
    maxChannels: OPENGD77_CHANNEL_SLOTS - 1, // CSV / export cap 1023
    supportsZones: true,
    supportsScanLists: false, // zone-as-scan-list
    analogOnly: false,
    supportsBle: false,
    supportsBulkRead: true,
  },
  attributionIds: ['qdmr'],
  compatibleProfiles: [{ formatId: 'radio-io', profileId: 'radio-io-opengd77-1701' }],
  writeStrategy: 'full-image',
  baudRate: OPENGD77_BAUD_RATE,
  hydration,
  restartAfterEnd: { seconds: OPENGD77_RESTART_AFTER_END_SECONDS },
  contactStore: 'shared-contact-bank',
  contactBankSlots: OPENGD77_FAMILY_LIMITS.CONTACTS_MAX,
  writeVerify: createOpenGd77WriteVerifyHooks(OPENGD77_DM1701_MODEL_ID),
  planStages: planOpenGd77Stages,
  satelliteKeps: OPENGD77_SATELLITE_KEPS_CAPABILITY,
};
