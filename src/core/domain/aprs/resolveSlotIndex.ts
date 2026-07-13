import type { AprsChannelSlot } from '@core/models/aprs.ts';
import type { Channel } from '@core/models/library.ts';
import type { EntityRef } from '@core/models/libraryTypes.ts';

/**
 * Map a per-channel `reportChannelRef` to the 1-based CPS slot index in the
 * active `AprsConfiguration.channelSlots` array. Returns `null` when the ref
 * does not match any slot channel or assembled channel list.
 */
export function resolveAprsSlotIndex(
  reportChannelRef: EntityRef | null | undefined,
  channelSlots: AprsChannelSlot[],
  assembledChannels: Channel[],
): number | null {
  if (!reportChannelRef || reportChannelRef.kind !== 'channel') return null;

  const channelIndexById = new Map(assembledChannels.map((ch, index) => [ch.id, index + 1]));

  for (let slotIndex = 0; slotIndex < channelSlots.length; slotIndex++) {
    const slot = channelSlots[slotIndex]!;
    const slotChannelId = slot.channelRef?.id;
    if (slotChannelId === reportChannelRef.id) {
      return slotIndex + 1;
    }
    if (slot.channelRef == null) {
      const assembledIndex = channelIndexById.get(reportChannelRef.id);
      if (assembledIndex != null) {
        return slotIndex + 1;
      }
    }
  }

  return null;
}
