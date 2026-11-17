/**
 * RT95 MM9PDY: the Write projection (zones, channel descriptions) as an MMD1 upload intent.
 */

import type { RadioChannelDto } from '../../radioChannelDto.ts';
import type { RadioWriteOrganisation } from '../../radioWriteProjection.ts';
import { encodeRt95ModData, type Rt95ModDataInput } from './modData/index.ts';

/** `null` unless the projection is for the MM9PDY target (`writeRt95ModData`). An empty table is still an intent. */
export function rt95ModDataIntentFromOrganisation(
  organisation: RadioWriteOrganisation | undefined,
  channels: readonly RadioChannelDto[] | undefined,
): Rt95ModDataInput | null {
  if (!organisation?.writeRt95ModData) return null;
  return {
    writeSections: true,
    zones: (organisation.zones ?? []).map((zone) => ({
      name: zone.wireName,
      channelIndexes: zone.channelNumbers.map((n) => n - 1),
      ...(zone.scanChannelNumbers
        ? { scanIndexes: zone.scanChannelNumbers.map((n) => n - 1) }
        : {}),
    })),
    descriptions: (channels ?? [])
      .filter((ch) => !ch.empty && ch.description !== undefined && ch.description !== '')
      .map((ch) => ({ channelIndex: ch.slotIndex - 1, text: ch.description! })),
  };
}

/**
 * Count exactly the blocks produced for upload; fingerprints do not affect block count. This runs the encoder, so it
 * throws `Rt95ModDataError` on an intent the encoder rejects; the projection never produces one (it caps zones,
 * members and duplicates first), so planning does not need a catch.
 */
export function rt95ModDataBlockCount(intent: Rt95ModDataInput): number {
  return encodeRt95ModData(intent, new Uint8Array(0x4000)).blocks.length;
}
