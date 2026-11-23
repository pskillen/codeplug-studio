/**
 * DM-32UV RadioFoundry cable descriptor.
 * Web Serial and the Android app both open at the descriptor baud. No transport picker.
 *
 * `programHoldSafeMs` is left unset. The debug link spec does not give an idle
 * disconnect. The 10 second figure in the fast-codeplug spec is the write
 * session after BEGIN, and that session is not open while Review is showing.
 */

import { DM32UV_RADIOFOUNDRY_LIMITS } from '@core/radios/baofeng/dm-32uv-radiofoundry/limits.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import type { MemoryMap, RadioDescriptor, RadioHydrationHooks } from '../../types.ts';
import { DM32UV_RADIOFOUNDRY_CABLE_BOARD as BOARD } from './board.ts';
import { planDm32RadioFoundryStages } from './plannedStages.ts';
import { createRadioFoundryCableProtocol } from './protocol.ts';

const hydration: RadioHydrationHooks = {
  extractHydration: (_image, meta) => ({
    formatId: 'radio-clone',
    capturedAt: meta?.capturedAt ?? new Date(0).toISOString(),
    ...(meta?.sourceFileName ? { sourceFileName: meta.sourceFileName } : {}),
    retain: {
      radioModelId: BOARD.modelId,
      capturedVia: 'web-serial',
      imageBase64: '',
      imageByteLength: 0,
    },
  }),
  mergeChannelsIntoHydration: (): MemoryMap => {
    throw new RadioProtocolError(
      'RadioFoundry write overlays the serialised codeplug onto the bytes read in this session. It does not merge a saved clone.',
    );
  },
};

export const DM32_RADIOFOUNDRY_DESCRIPTOR: RadioDescriptor = {
  modelIds: [BOARD.modelId],
  label: BOARD.label,
  group: 'Baofeng',
  supportsBle: false,
  protocolFactory: () => createRadioFoundryCableProtocol(BOARD),
  capabilities: {
    maxChannels: DM32UV_RADIOFOUNDRY_LIMITS.CHANNEL_MAX,
    supportsZones: true,
    supportsScanLists: false,
    analogOnly: false,
    supportsBle: false,
    supportsBulkRead: true,
  },
  attributionIds: [],
  compatibleProfiles: [{ formatId: 'radio-io', profileId: BOARD.radioIoProfileId }],
  writeStrategy: 'selective-ranges',
  baudRate: BOARD.baudRate,
  hydration,
  planStages: planDm32RadioFoundryStages,
};
