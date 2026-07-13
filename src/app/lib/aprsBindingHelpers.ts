import type { AprsChannelSlot, AprsConfiguration, ChannelAprsBinding } from '@core/models/aprs.ts';
import type { Channel } from '@core/models/library.ts';
import { CHANNEL_APRS_OFF } from '@core/domain/aprs/defaults.ts';
import { normalizeOptionalChannelAprs } from '@core/domain/aprs/index.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';

export function channelLabelForSlot(
  slot: AprsChannelSlot,
  channels: Channel[],
): string {
  if (!slot.channelRef) return 'Current channel';
  const channel = channels.find((c) => c.id === slot.channelRef?.id);
  return channel ? channelDisplayLabel(channel) : 'Missing channel';
}

export function formatAprsAssignmentSummary(
  binding: ChannelAprsBinding | undefined,
  slots: AprsChannelSlot[],
  channels: Channel[],
): string {
  if (!binding || binding.reportType === 'off') return '—';
  if (binding.reportType === 'digital' && binding.reportSlotIndex == null) return 'Digital';
  if (binding.reportType === 'digital' && binding.reportSlotIndex != null) {
    const slot = slots[binding.reportSlotIndex - 1];
    if (!slot) return 'Digital';
    const channelLabel = channelLabelForSlot(slot, channels);
    return `${binding.reportSlotIndex} · ${channelLabel}`;
  }
  return '—';
}

export { aprsSlotSelectOptions, APRS_SLOT_NONE_VALUE } from './aprsSlotOptions.ts';

export function channelAprsBindingFromChannel(channel: Channel): ChannelAprsBinding {
  return channel.aprs ?? { ...CHANNEL_APRS_OFF };
}

export function channelHasDmrProfile(channel: Channel): boolean {
  return channel.modeProfiles.some((profile) => profile.mode === 'dmr');
}

export function normalizeChannelAprsBindingForSave(
  binding: ChannelAprsBinding | undefined,
  config: AprsConfiguration | null,
): ChannelAprsBinding | undefined {
  const maxSlots = config?.channelSlots.length ?? 0;
  const normalized = normalizeOptionalChannelAprs(binding, [], maxSlots);
  if (binding?.reportSlotIndex != null && maxSlots > 0 && binding.reportSlotIndex > maxSlots) {
    return normalizeOptionalChannelAprs(
      { ...binding, reportSlotIndex: null },
      [],
      maxSlots,
    );
  }
  return normalized;
}

export function aprsBindingDraftKey(binding: ChannelAprsBinding | undefined): string {
  if (!binding) return '';
  return [
    binding.receiveEnabled ? '1' : '0',
    binding.reportType,
    binding.digitalPttMode,
    binding.reportSlotIndex ?? '',
  ].join(':');
}
