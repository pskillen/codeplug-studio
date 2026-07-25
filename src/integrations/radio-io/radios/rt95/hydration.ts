/**
 * Bridge MemoryMap ↔ EgressPath radio-clone hydration for RT95 VOX.
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import type { RadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import {
  createRadioCloneHydrationBag,
  radioCloneImageBytes,
} from '@core/models/radioCloneHydration.ts';
import { memoryMapFromBytes, memoryMapToBytes } from '../../kit/memoryMap.ts';
import type { RadioWriteOrganisation } from '../../radioWriteProjection.ts';
import { RT95_IMAGE_SIZE, RT95_MODEL_ID } from './constants.ts';
import { encodeChannelsIntoImage } from './channelCodec.ts';

export { RT95_MODEL_ID };

export function extractRt95Hydration(
  image: MemoryMap,
  meta?: { sourceFileName?: string; capturedAt?: string },
): RadioCloneHydrationBag {
  const bytes = memoryMapToBytes(image);
  if (bytes.length < RT95_IMAGE_SIZE) {
    throw new RangeError(`RT95 hydration expects image ≥ 0x${RT95_IMAGE_SIZE.toString(16)} bytes`);
  }
  return createRadioCloneHydrationBag({
    radioModelId: RT95_MODEL_ID,
    imageBytes: bytes,
    capturedVia: 'web-serial',
    sourceFileName: meta?.sourceFileName,
    capturedAt: meta?.capturedAt,
  });
}

export function memoryMapFromRt95Hydration(bag: RadioCloneHydrationBag): MemoryMap {
  return memoryMapFromBytes(radioCloneImageBytes(bag));
}

export function mergeChannelsIntoRt95Hydration(
  bag: RadioCloneHydrationBag,
  channels: readonly RadioChannelDto[],
  organisation?: RadioWriteOrganisation,
): MemoryMap {
  void organisation;
  const image = memoryMapFromRt95Hydration(bag);
  encodeChannelsIntoImage(image, channels);
  return image;
}
