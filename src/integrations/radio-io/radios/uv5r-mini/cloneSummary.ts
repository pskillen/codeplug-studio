/**
 * Read-only summary of a UV-5R Mini radio-clone hydration bag for build UI.
 * Does not decode labelled settings enums yet — shows retain metadata + region map.
 */

import type { RadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import { radioCloneImageBytes } from '@core/models/radioCloneHydration.ts';
import { memoryMapFromBytes } from '../../kit/memoryMap.ts';
import {
  UV5R_MINI_CHANNEL_COUNT,
  UV5R_MINI_CHANNEL_SPAN,
  UV5R_MINI_MEM_TOTAL,
} from './constants.ts';
import { decodeChannelsFromImage, readFirmwareFromImage } from './channelCodec.ts';

export interface RadioCloneRegionSummary {
  label: string;
  /** Packed image offset (hex display uses this). */
  packedOffset: number;
  sizeBytes: number;
  /** What Studio does with this region on write. */
  role: string;
}

export interface Uv5rMiniCloneSummary {
  radioModelId: string;
  firmware?: string;
  imageByteLength: number;
  capturedVia: RadioCloneHydrationBag['retain']['capturedVia'];
  occupiedChannelCount: number;
  emptyChannelSlots: number;
  regions: readonly RadioCloneRegionSummary[];
}

/** Packed-image regions Studio preserves outside modelled channel encode. */
export const UV5R_MINI_CLONE_REGION_SUMMARIES: readonly RadioCloneRegionSummary[] = [
  {
    label: 'Channel memories',
    packedOffset: 0x0000,
    sizeBytes: UV5R_MINI_CHANNEL_SPAN,
    role: 'Replaced from assemble() on Write; library is the source of truth',
  },
  {
    label: 'VFO A',
    packedOffset: 0x8000,
    sizeBytes: 32,
    role: 'Opaque retain — not modelled in the library',
  },
  {
    label: 'VFO B',
    packedOffset: 0x8020,
    sizeBytes: 32,
    role: 'Opaque retain — not modelled in the library',
  },
  {
    label: 'Radio settings',
    packedOffset: 0x8040,
    sizeBytes: 64,
    role: 'Opaque retain — not modelled in the library',
  },
  {
    label: 'ANI / PTT / codes area',
    packedOffset: 0x8080,
    sizeBytes: UV5R_MINI_MEM_TOTAL - 0x8080,
    role: 'Opaque retain — not modelled in the library',
  },
];

export function summariseUv5rMiniClone(bag: RadioCloneHydrationBag): Uv5rMiniCloneSummary {
  const bytes = radioCloneImageBytes(bag);
  const image = memoryMapFromBytes(bytes);
  const channels = decodeChannelsFromImage(image);
  const occupied = channels.filter((c) => !c.empty).length;
  const firmware = bag.retain.firmware ?? readFirmwareFromImage(image);

  return {
    radioModelId: bag.retain.radioModelId,
    firmware,
    imageByteLength: bag.retain.imageByteLength,
    capturedVia: bag.retain.capturedVia,
    occupiedChannelCount: occupied,
    emptyChannelSlots: UV5R_MINI_CHANNEL_COUNT - occupied,
    regions: UV5R_MINI_CLONE_REGION_SUMMARIES,
  };
}
