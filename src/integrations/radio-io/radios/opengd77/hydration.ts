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
import { RadioProtocolError } from '../../kit/errors.ts';
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

export const OPENGD77_EMPTY_WRITE_PRIOR_MESSAGE =
  'Read this radio in the current session before Write. OpenGD77 write encodes onto the in-session FLASH image — it will not fall back to a blank 0xff map.';

/**
 * Overlay modelled organisation + channels onto a copy of an existing radio image.
 * Order: contacts → RX groups → channels → zones (FK dependency).
 *
 * Organisation contact / RX banks are **fully replaced** when `talkGroups` or
 * `digitalContacts` is present (empty arrays wipe). Omit both to keep prior
 * FLASH contacts (directory-only User Database write). Settings / APRS / DTMF /
 * VFO / additional settings are untouched.
 */
export function encodeOpenGd77ProjectionOntoImage(
  image: MemoryMap,
  channels: readonly RadioChannelDto[],
  organisation?: RadioWriteOrganisation,
  opts?: { powerSteps?: readonly OpenGd77PowerStep[] },
): MemoryMap {
  const next = openUv380ImageFromBytes(image.bytes);
  const replaceContacts =
    organisation?.talkGroups !== undefined || organisation?.digitalContacts !== undefined;
  if (replaceContacts) {
    const contacts = mergeOrganisationContacts(
      organisation?.talkGroups,
      organisation?.digitalContacts,
    );
    encodeContactsIntoImage(next, contacts);
    const byDigitalId = contactIndexByDigitalId(contacts);
    const useContactIndices = (organisation?.talkGroups ?? []).some(
      (tg) => tg.timeSlotOverride != null,
    );
    encodeRxGroupsIntoImage(next, organisation?.rxGroups ?? [], byDigitalId, {
      memberIdsAreContactIndices: useContactIndices,
    });
  }
  encodeChannelsIntoImage(next, channels, {
    clearUnlisted: true,
    powerSteps: opts?.powerSteps,
  });
  encodeZonesIntoImage(next, organisation?.zones ?? []);
  return next;
}

/** Encode modelled overlay onto an in-session FLASH prior. Empty / undersized prior is refused. */
export function encodeOpenGd77WriteImageFromPrior(
  prior: MemoryMap | null | undefined,
  channels: readonly RadioChannelDto[],
  organisation?: RadioWriteOrganisation,
  opts?: { powerSteps?: readonly OpenGd77PowerStep[] },
): MemoryMap {
  if (!prior || prior.size !== OPENUV380_IMAGE_SIZE) {
    throw new RadioProtocolError(OPENGD77_EMPTY_WRITE_PRIOR_MESSAGE);
  }
  return encodeOpenGd77ProjectionOntoImage(prior, channels, organisation, opts);
}

/**
 * Encode modelled organisation + channels into a copy of the hydrated image.
 * Write uses {@link encodeOpenGd77WriteImageFromPrior} on the in-session prior instead.
 */
export function mergeChannelsIntoOpenGd77Hydration(
  bag: RadioCloneHydrationBag,
  channels: readonly RadioChannelDto[],
  organisation?: RadioWriteOrganisation,
  opts?: { powerSteps?: readonly OpenGd77PowerStep[] },
): MemoryMap {
  return encodeOpenGd77ProjectionOntoImage(
    memoryMapFromOpenGd77Hydration(bag),
    channels,
    organisation,
    opts,
  );
}
