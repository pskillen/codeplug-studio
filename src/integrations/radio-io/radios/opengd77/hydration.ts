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
import { OPENUV380_IMAGE_SIZE } from './constants.ts';
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

export function extractOpenGd77Hydration(
  image: MemoryMap,
  meta?: { sourceFileName?: string; capturedAt?: string; firmware?: string },
): RadioCloneHydrationBag {
  const bytes = openUv380ImageToBytes(image);
  if (bytes.length < OPENUV380_IMAGE_SIZE) {
    throw new RangeError(
      `OpenUV380 hydration expects image ≥ 0x${OPENUV380_IMAGE_SIZE.toString(16)} bytes`,
    );
  }
  return createRadioCloneHydrationBag({
    radioModelId: OPENGD77_DM1701_MODEL_ID,
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
 */
export function mergeChannelsIntoOpenGd77Hydration(
  bag: RadioCloneHydrationBag,
  channels: readonly RadioChannelDto[],
  organisation?: RadioWriteOrganisation,
): MemoryMap {
  const image = memoryMapFromOpenGd77Hydration(bag);
  const contacts = mergeOrganisationContacts(
    organisation?.talkGroups,
    organisation?.digitalContacts,
  );
  encodeContactsIntoImage(image, contacts);
  const byDigitalId = contactIndexByDigitalId(contacts);
  if (organisation?.rxGroups) {
    encodeRxGroupsIntoImage(image, organisation.rxGroups, byDigitalId);
  }
  encodeChannelsIntoImage(image, channels);
  if (organisation?.zones) {
    encodeZonesIntoImage(image, organisation.zones);
  }
  return image;
}
