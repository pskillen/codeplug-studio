/**
 * UV-21Pro V2 radio descriptor — registry entry for Web Serial I/O.
 * Cite: CHIRP baofeng_uv17Pro.py UV21ProV2(UV17Pro).
 */

import type { RadioDescriptor } from '../../types.ts';
import { UV21_PRO_V2_LAYOUT } from '../uv17pro-family/layout.ts';
import {
  extractUv17ProHydration,
  mergeChannelsIntoUv17ProHydration,
} from '../uv17pro-family/hydration.ts';
import { createUv17ProProtocol } from '../uv17pro-family/protocol.ts';
import { createUv17ProWriteVerifyHooks } from '../uv17pro-family/writeVerifyHooks.ts';

export const UV21_PRO_V2_MODEL_ID = UV21_PRO_V2_LAYOUT.radioModelId;

export const UV21_PRO_V2_DESCRIPTOR: RadioDescriptor = {
  modelIds: [UV21_PRO_V2_MODEL_ID, 'UV-21Pro V2'],
  label: 'Baofeng UV-21Pro V2',
  group: 'Baofeng',
  supportsBle: false,
  protocolFactory: () => createUv17ProProtocol(UV21_PRO_V2_LAYOUT),
  capabilities: {
    maxChannels: UV21_PRO_V2_LAYOUT.channelCount,
    supportsZones: false,
    supportsScanLists: false,
    analogOnly: true,
    supportsBle: false,
    supportsBulkRead: true,
  },
  attributionIds: ['chirp'],
  compatibleProfiles: [{ formatId: 'radio-io', profileId: 'radio-io-uv21' }],
  writeStrategy: 'full-image',
  hydrationRequiredForWrite: true,
  baudRate: UV21_PRO_V2_LAYOUT.baudRate,
  hydration: {
    extractHydration: (image, meta) => extractUv17ProHydration(UV21_PRO_V2_LAYOUT, image, meta),
    mergeChannelsIntoHydration: (bag, channels, organisation) =>
      mergeChannelsIntoUv17ProHydration(UV21_PRO_V2_LAYOUT, bag, channels, organisation),
  },
  writeVerify: createUv17ProWriteVerifyHooks(UV21_PRO_V2_LAYOUT),
};
