/**
 * RadioFoundry cable descriptors.
 * Web Serial and the Android app both open at the descriptor baud. No transport picker.
 *
 * `programHoldSafeMs` is left unset. The debug link spec does not give an idle
 * disconnect. The 10 second figure in the fast-codeplug spec is the write
 * session after BEGIN, and that session is not open while Review is showing.
 */

import { RADIOFOUNDRY_LIMITS } from '@core/radios/radiofoundry/limits.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import type { MemoryMap, RadioDescriptor, RadioHydrationHooks } from '../../types.ts';
import {
  DM1701_RADIOFOUNDRY_CABLE_BOARD,
  DM32UV_RADIOFOUNDRY_CABLE_BOARD,
  MD9600_RADIOFOUNDRY_CABLE_BOARD,
  RT84_RADIOFOUNDRY_CABLE_BOARD,
  type RadioFoundryCableBoard,
} from './board.ts';
import { planRadioFoundryStages } from './plannedStages.ts';
import { createRadioFoundryCableProtocol } from './protocol.ts';

/** One RadioFoundry radio's descriptor. Every board gets one from here; nothing else differs per board. */
export function createRadioFoundryDescriptor(board: RadioFoundryCableBoard): RadioDescriptor {
  const hydration: RadioHydrationHooks = {
    extractHydration: (_image, meta) => ({
      formatId: 'radio-clone',
      capturedAt: meta?.capturedAt ?? new Date(0).toISOString(),
      ...(meta?.sourceFileName ? { sourceFileName: meta.sourceFileName } : {}),
      retain: {
        radioModelId: board.modelId,
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
  return {
    modelIds: [board.modelId],
    label: board.label,
    group: board.group,
    supportsBle: false,
    protocolFactory: () => createRadioFoundryCableProtocol(board),
    capabilities: {
      maxChannels: RADIOFOUNDRY_LIMITS.CHANNEL_MAX,
      supportsZones: true,
      supportsScanLists: false,
      analogOnly: false,
      supportsBle: false,
      supportsBulkRead: true,
    },
    attributionIds: [],
    compatibleProfiles: [{ formatId: 'radio-io', profileId: board.radioIoProfileId }],
    writeStrategy: 'selective-ranges',
    baudRate: board.baudRate,
    hydration,
    planStages: planRadioFoundryStages,
    ...(board.prodWriteDisabled ? { prodWriteDisabled: true } : {}),
  };
}

export const DM32_RADIOFOUNDRY_DESCRIPTOR: RadioDescriptor = createRadioFoundryDescriptor(
  DM32UV_RADIOFOUNDRY_CABLE_BOARD,
);

export const DM1701_RADIOFOUNDRY_DESCRIPTOR: RadioDescriptor = createRadioFoundryDescriptor(
  DM1701_RADIOFOUNDRY_CABLE_BOARD,
);

export const RT84_RADIOFOUNDRY_DESCRIPTOR: RadioDescriptor = createRadioFoundryDescriptor(
  RT84_RADIOFOUNDRY_CABLE_BOARD,
);

export const MD9600_RADIOFOUNDRY_DESCRIPTOR: RadioDescriptor = createRadioFoundryDescriptor(
  MD9600_RADIOFOUNDRY_CABLE_BOARD,
);
