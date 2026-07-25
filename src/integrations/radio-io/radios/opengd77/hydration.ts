/**
 * Bridge MemoryMap ↔ EgressPath radio-clone hydration for OpenUV380.
 */

import {
  createRadioCloneHydrationBag,
  radioCloneImageBytes,
  type RadioCloneHydrationBag,
} from '@core/models/radioCloneHydration.ts';
import type { MemoryMap } from '../../types.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import type { RadioWriteOrganisation } from '../../radioWriteProjection.ts';
import { OPENUV380_IMAGE_SIZE, type OpenGd77PowerStep } from './constants.ts';
import { encodeChannelsIntoImage } from './channelCodec.ts';
import {
  contactIndexByDigitalId,
  encodeContactsIntoImage,
  mergeOrganisationContacts,
} from './contactCodec.ts';
import { createOpenUv380Image, openUv380ImageFromBytes, openUv380ImageToBytes } from './memory.ts';
import { encodeRxGroupsIntoImage } from './rxGroupCodec.ts';
import { encodeZonesIntoImage } from './zoneCodec.ts';

export const OPENGD77_DM1701_MODEL_ID = 'DM-1701';
export const OPENGD77_MD9600_MODEL_ID = 'MD-9600';

export function extractOpenGd77Hydration(
  image: MemoryMap,
  meta?: {
    sourceFileName?: string;
    capturedAt?: string;
    firmware?: string;
    radioModelId?: string;
  },
): RadioCloneHydrationBag {
  const bytes = openUv380ImageToBytes(image);
  if (bytes.length < OPENUV380_IMAGE_SIZE) {
    throw new RangeError(
      `OpenUV380 hydration expects image ≥ 0x${OPENUV380_IMAGE_SIZE.toString(16)} bytes`,
    );
  }
  return createRadioCloneHydrationBag({
    radioModelId: meta?.radioModelId ?? OPENGD77_DM1701_MODEL_ID,
    imageBytes: bytes,
    firmware: meta?.firmware,
    capturedVia: 'web-serial',
    sourceFileName: meta?.sourceFileName,
    capturedAt: meta?.capturedAt,
  });
}

export function memoryMapFromOpenGd77Hydration(bag: RadioCloneHydrationBag): MemoryMap {
  const bytes = radioCloneImageBytes(bag);
  if (bytes.length === 0) {
    return createOpenUv380Image();
  }
  return openUv380ImageFromBytes(bytes);
}

/**
 * Encode modelled organisation + channels into a copy of the hydrated image.
 * Order: contacts → RX groups → channels → zones (FK dependency).
 *
 * Organisation banks are **fully replaced** from the projection (empty arrays wipe
 * prior payload). Settings / APRS / DTMF / VFO / additional settings are untouched.
 */
export function mergeChannelsIntoOpenGd77Hydration(
  bag: RadioCloneHydrationBag,
  channels: readonly RadioChannelDto[],
  organisation?: RadioWriteOrganisation,
  opts?: { powerSteps?: readonly OpenGd77PowerStep[] },
): MemoryMap {
  const image = memoryMapFromOpenGd77Hydration(bag);
  const contacts = mergeOrganisationContacts(
    organisation?.talkGroups,
    organisation?.digitalContacts,
  );
  encodeContactsIntoImage(image, contacts);
  const byDigitalId = contactIndexByDigitalId(contacts);
  encodeRxGroupsIntoImage(image, organisation?.rxGroups ?? [], byDigitalId);
  encodeChannelsIntoImage(image, channels, {
    clearUnlisted: true,
    powerSteps: opts?.powerSteps,
  });
  encodeZonesIntoImage(image, organisation?.zones ?? []);
  return image;
}
