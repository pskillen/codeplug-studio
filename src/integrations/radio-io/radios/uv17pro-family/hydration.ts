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

/**
 * Overlay modelled channels onto an in-session download base (Write pre-read path).
 * Does not require a persisted egress hydration bag.
 */
export function encodeUv17ProWriteImageFromPrior(
  layout: Uv17ProLayout,
  prior: MemoryMap | null | undefined,
  channels: readonly RadioChannelDto[],
  organisation?: import('../../radioWriteProjection.ts').RadioWriteOrganisation,
): MemoryMap {
  void organisation;
  if (!prior || prior.size < layout.memTotal) {
    throw new RangeError(
      `${layout.protocolLabel} write encode expects an in-session prior ≥ 0x${layout.memTotal.toString(16)} bytes`,
    );
  }
  const image = memoryMapFromBytes(prior.bytes);
  encodeChannelsIntoImage(layout, image, channels);
  return image;
}

/**
 * Encode modelled channels into a copy of the hydrated image.
 * Write uses {@link encodeUv17ProWriteImageFromPrior} on the in-session prior instead.
 */
export function mergeChannelsIntoUv17ProHydration(
  layout: Uv17ProLayout,
  bag: RadioCloneHydrationBag,
  channels: readonly RadioChannelDto[],
  organisation?: import('../../radioWriteProjection.ts').RadioWriteOrganisation,
): MemoryMap {
  return encodeUv17ProWriteImageFromPrior(
    layout,
    memoryMapFromUv17ProHydration(bag),
    channels,
    organisation,
  );
}
