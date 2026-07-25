/**
 * Bridge MemoryMap ↔ EgressPath radio-clone hydration for UV-17Pro family radios.
 */

import {
  createRadioCloneHydrationBag,
  radioCloneImageBytes,
  type RadioCloneHydrationBag,
} from '@core/models/radioCloneHydration.ts';
import type { MemoryMap } from '../../types.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { memoryMapFromBytes, memoryMapToBytes } from '../../kit/memoryMap.ts';
import type { Uv17ProLayout } from './layout.ts';
import { encodeChannelsIntoImage, readFirmwareFromImage } from './channelCodec.ts';

export function extractUv17ProHydration(
  layout: Uv17ProLayout,
  image: MemoryMap,
  meta?: { sourceFileName?: string; capturedAt?: string },
): RadioCloneHydrationBag {
  const bytes = memoryMapToBytes(image);
  if (bytes.length < layout.memTotal) {
    throw new RangeError(
      `${layout.protocolLabel} hydration expects image ≥ 0x${layout.memTotal.toString(16)} bytes`,
    );
  }
  return createRadioCloneHydrationBag({
    radioModelId: layout.radioModelId,
    imageBytes: bytes,
    firmware: readFirmwareFromImage(layout, image),
    capturedVia: 'web-serial',
    sourceFileName: meta?.sourceFileName,
    capturedAt: meta?.capturedAt,
  });
}

export function memoryMapFromUv17ProHydration(bag: RadioCloneHydrationBag): MemoryMap {
  return memoryMapFromBytes(radioCloneImageBytes(bag));
}

export function mergeChannelsIntoUv17ProHydration(
  layout: Uv17ProLayout,
  bag: RadioCloneHydrationBag,
  channels: readonly RadioChannelDto[],
  organisation?: import('../../radioWriteProjection.ts').RadioWriteOrganisation,
): MemoryMap {
  void organisation;
  const image = memoryMapFromUv17ProHydration(bag);
  encodeChannelsIntoImage(layout, image, channels);
  return image;
}
