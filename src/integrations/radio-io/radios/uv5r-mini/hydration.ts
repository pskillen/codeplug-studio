/**
 * Bridge MemoryMap ↔ FormatBuild radio-clone hydration for UV-5R Mini.
 */

import {
  createRadioCloneHydrationBag,
  radioCloneImageBytes,
  type RadioCloneHydrationBag,
} from '@core/models/radioCloneHydration.ts';
import type { MemoryMap } from '../../types.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { memoryMapFromBytes, memoryMapToBytes } from '../../kit/memoryMap.ts';
import { UV5R_MINI_MEM_TOTAL } from './constants.ts';
import { encodeChannelsIntoImage, readFirmwareFromImage } from './channelCodec.ts';

export const UV5R_MINI_MODEL_ID = 'UV5R-Mini';

/** Persist a downloaded clone image as FormatBuild.cpsWireHydration. */
export function extractUv5rMiniHydration(
  image: MemoryMap,
  meta?: { sourceFileName?: string; capturedAt?: string },
): RadioCloneHydrationBag {
  const bytes = memoryMapToBytes(image);
  if (bytes.length < UV5R_MINI_MEM_TOTAL) {
    throw new RangeError(
      `UV-5R Mini hydration expects image ≥ 0x${UV5R_MINI_MEM_TOTAL.toString(16)} bytes`,
    );
  }
  return createRadioCloneHydrationBag({
    radioModelId: UV5R_MINI_MODEL_ID,
    imageBytes: bytes,
    firmware: readFirmwareFromImage(image),
    capturedVia: 'web-serial',
    sourceFileName: meta?.sourceFileName,
    capturedAt: meta?.capturedAt,
  });
}

/** Restore MemoryMap from a radio-clone hydration bag. */
export function memoryMapFromUv5rMiniHydration(bag: RadioCloneHydrationBag): MemoryMap {
  return memoryMapFromBytes(radioCloneImageBytes(bag));
}

/**
 * Encode modelled channels into a copy of the hydrated image.
 * Non-channel bytes (settings/VFO/ANI) are preserved.
 */
export function mergeChannelsIntoUv5rMiniHydration(
  bag: RadioCloneHydrationBag,
  channels: readonly RadioChannelDto[],
): MemoryMap {
  const image = memoryMapFromUv5rMiniHydration(bag);
  encodeChannelsIntoImage(image, channels);
  return image;
}
