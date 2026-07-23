/**
 * Read-only summary of a DM-32UV sparse radio-clone hydration bag.
 */

import type { RadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import {
  radioCloneHasSparseBlocks,
  radioCloneSparseBlockBytes,
} from '@core/models/radioCloneHydration.ts';
import { decodeChannelsFromDm32Image } from './channelCodec.ts';
import { memoryMapFromDm32uvHydration } from './hydration.ts';
import { DM32_METADATA_OFFSET } from './constants.ts';
import type { RadioCloneRegionSummary } from '../uv5r-mini/cloneSummary.ts';

export interface Dm32uvCloneSummary {
  radioModelId: string;
  firmware?: string;
  imageByteLength: number;
  capturedVia: RadioCloneHydrationBag['retain']['capturedVia'];
  occupiedChannelCount: number;
  emptyChannelSlots: number;
  blockCount: number;
  regions: readonly RadioCloneRegionSummary[];
}

export function summariseDm32uvClone(bag: RadioCloneHydrationBag): Dm32uvCloneSummary {
  const image = memoryMapFromDm32uvHydration(bag);
  const addressBase = bag.retain.addressBase ?? 0;
  const sparse = radioCloneSparseBlockBytes(bag);
  const discovered = sparse.map((b) => ({
    address: b.address,
    metadata: b.data[DM32_METADATA_OFFSET] ?? 0,
  }));
  const channels = decodeChannelsFromDm32Image(image, { addressBase, discovered });
  const occupied = channels.filter((c) => !c.empty).length;
  const regions: RadioCloneRegionSummary[] = sparse.map((b) => ({
    label: `Block 0x${b.address.toString(16).toUpperCase()} (meta 0x${(b.data[DM32_METADATA_OFFSET] ?? 0).toString(16)})`,
    packedOffset: b.address - addressBase,
    sizeBytes: b.data.length,
    role:
      (b.data[DM32_METADATA_OFFSET] ?? 0) >= 0x12 && (b.data[DM32_METADATA_OFFSET] ?? 0) <= 0x41
        ? 'Channel bank — modelled channels rewritten on Write'
        : 'Opaque retain — preserved on Write (RMW)',
  }));

  return {
    radioModelId: bag.retain.radioModelId,
    firmware: bag.retain.firmware,
    imageByteLength: bag.retain.imageByteLength,
    capturedVia: bag.retain.capturedVia,
    occupiedChannelCount: occupied,
    emptyChannelSlots: Math.max(0, channels.length - occupied),
    blockCount: radioCloneHasSparseBlocks(bag) ? sparse.length : 0,
    regions,
  };
}
