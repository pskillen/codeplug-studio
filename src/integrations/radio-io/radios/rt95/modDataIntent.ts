/**
 * RT95 MM9PDY: the Write projection (zones, channel descriptions) as an MMD1 upload intent.
 */

import type { RadioChannelDto } from '../../radioChannelDto.ts';
import type { RadioWriteOrganisation } from '../../radioWriteProjection.ts';
import type { Rt95ModDataInput } from './modData/index.ts';

/** `null` unless the projection is for the MM9PDY target (`writeRt95ModData`). An empty table is still an intent. */
export function rt95ModDataIntentFromOrganisation(
  organisation: RadioWriteOrganisation | undefined,
  channels: readonly RadioChannelDto[] | undefined,
): Rt95ModDataInput | null {
  if (!organisation?.writeRt95ModData) return null;
  return {
    zones: (organisation.zones ?? []).map((zone) => ({
      name: zone.wireName,
      channelIndexes: zone.channelNumbers.map((n) => n - 1),
    })),
    descriptions: (channels ?? [])
      .filter((ch) => !ch.empty && ch.description !== undefined && ch.description !== '')
      .map((ch) => ({ channelIndex: ch.slotIndex - 1, text: ch.description! })),
  };
}

/** Blocks the MMD1 table adds to a Write: D + 3 * N + 1 (descriptions, two slot halves and a name per zone, header). */
export function rt95ModDataBlockCount(intent: Rt95ModDataInput): number {
  const descriptions = intent.descriptions.filter((d) => d.text !== '').length;
  return descriptions + 3 * intent.zones.length + 1;
}
