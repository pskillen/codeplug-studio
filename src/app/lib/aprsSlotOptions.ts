import type { AprsChannelSlot } from '@core/models/aprs.ts';
import type { Channel } from '@core/models/library.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';

export const APRS_SLOT_NONE_VALUE = '';

export function aprsSlotSelectOptions(
  slots: AprsChannelSlot[],
  channels: Channel[],
): { value: string; label: string }[] {
  return [
    { value: APRS_SLOT_NONE_VALUE, label: 'None' },
    ...slots.map((slot, index) => {
      const slotNumber = index + 1;
      if (slot.channelRef?.kind === 'channel') {
        const channel = channels.find((row) => row.id === slot.channelRef?.id);
        const channelLabel = channel ? channelDisplayLabel(channel) : 'missing channel';
        return { value: String(slotNumber), label: `Slot ${slotNumber} — ${channelLabel}` };
      }
      return { value: String(slotNumber), label: `Slot ${slotNumber} — current channel` };
    }),
  ];
}
