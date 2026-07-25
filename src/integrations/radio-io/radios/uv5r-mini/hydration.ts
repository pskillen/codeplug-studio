/**
 * Bridge MemoryMap ↔ EgressPath radio-clone hydration for UV-5R Mini.
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import type { RadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import { UV5R_MINI_LAYOUT } from '../uv17pro-family/layout.ts';
import {
  extractUv17ProHydration,
  memoryMapFromUv17ProHydration,
  mergeChannelsIntoUv17ProHydration,
} from '../uv17pro-family/hydration.ts';

export const UV5R_MINI_MODEL_ID = UV5R_MINI_LAYOUT.radioModelId;

export function extractUv5rMiniHydration(
  image: MemoryMap,
  meta?: { sourceFileName?: string; capturedAt?: string },
): RadioCloneHydrationBag {
  return extractUv17ProHydration(UV5R_MINI_LAYOUT, image, meta);
}

export function memoryMapFromUv5rMiniHydration(bag: RadioCloneHydrationBag): MemoryMap {
  return memoryMapFromUv17ProHydration(bag);
}

export function mergeChannelsIntoUv5rMiniHydration(
  bag: RadioCloneHydrationBag,
  channels: readonly RadioChannelDto[],
  organisation?: import('../../radioWriteProjection.ts').RadioWriteOrganisation,
): MemoryMap {
  return mergeChannelsIntoUv17ProHydration(UV5R_MINI_LAYOUT, bag, channels, organisation);
}
