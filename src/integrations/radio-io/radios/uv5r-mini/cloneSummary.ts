/**
 * Read-only summary of a UV-5R Mini radio-clone hydration bag for build UI.
 */

import type { RadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import { radioCloneImageBytes } from '@core/models/radioCloneHydration.ts';
import { memoryMapFromBytes } from '../../kit/memoryMap.ts';
import { UV5R_MINI_CHANNEL_COUNT } from './constants.ts';
import { decodeChannelsFromImage, readFirmwareFromImage } from './channelCodec.ts';
import {
  UV5R_MINI_REGION_MANIFEST,
  UV5R_MINI_WRITTEN_FROM_BUILD_LABELS,
  uv5rMiniKeptRegions,
} from './writeRole.ts';

/** @deprecated Use Uv5rMiniRetainGroupSummary — kept for barrel compatibility. */
export interface RadioCloneRegionSummary {
  label: string;
  packedOffset: number;
  sizeBytes: number;
  role: string;
}

export interface Uv5rMiniOnRadioCounts {
  occupiedChannels: number;
  emptyChannelSlots: number;
}

export interface Uv5rMiniRetainGroupSummary {
  label: string;
  regionCount: number;
  role: string;
}

export interface Uv5rMiniCloneSummary {
  radioModelId: string;
  firmware?: string;
  imageByteLength: number;
  capturedVia: RadioCloneHydrationBag['retain']['capturedVia'];
  onRadioCounts: Uv5rMiniOnRadioCounts;
  writtenFromBuild: readonly string[];
  retainGroups: readonly Uv5rMiniRetainGroupSummary[];
}

/** Legacy region table derived from write-role manifest. */
export const UV5R_MINI_CLONE_REGION_SUMMARIES: readonly RadioCloneRegionSummary[] =
  UV5R_MINI_REGION_MANIFEST.map((r) => ({
    label: r.label,
    packedOffset: r.packedOffset,
    sizeBytes: r.sizeBytes,
    role: r.retainRoleCopy,
  }));

function buildRetainGroups(): Uv5rMiniRetainGroupSummary[] {
  return uv5rMiniKeptRegions().map((r) => ({
    label: r.label,
    regionCount: 1,
    role: r.retainRoleCopy,
  }));
}

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
    onRadioCounts: {
      occupiedChannels: occupied,
      emptyChannelSlots: UV5R_MINI_CHANNEL_COUNT - occupied,
    },
    writtenFromBuild: [...UV5R_MINI_WRITTEN_FROM_BUILD_LABELS],
    retainGroups: buildRetainGroups(),
  };
}
