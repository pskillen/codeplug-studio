import type { AprsChannelSlot, AprsConfiguration, ChannelAprsBinding } from '@core/models/aprs.ts';
import type { Channel } from '@core/models/library.ts';
import { classifyAnytoneExportChannelBank } from '@core/import-export/formats/anytone/receiveOnlyBanks.ts';
import { CHANNEL_APRS_OFF } from '@core/domain/aprs/defaults.ts';
import { normalizeOptionalChannelAprs } from '@core/domain/aprs/index.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import { sortByName } from './channels.ts';

const APRS_SLOT_BANK_GROUP_LABELS = {
  dmr: 'DMR / main bank',
  amAir: 'AM air',
  fmBroadcast: 'FM broadcast',
} as const;

export function aprsSlotChannelSelectGroups(channels: Channel[]) {
  const grouped: Record<'dmr' | 'amAir' | 'fmBroadcast', { value: string; label: string }[]> = {
    dmr: [],
    amAir: [],
    fmBroadcast: [],
  };

  for (const channel of sortByName(channels)) {
    const bank = classifyAnytoneExportChannelBank(channel);
    grouped[bank].push({
      value: channel.id,
      label: channelDisplayLabel(channel),
    });
  }

  return [
    { group: 'Special', items: [{ value: '', label: 'Current channel' }] },
    { group: APRS_SLOT_BANK_GROUP_LABELS.dmr, items: grouped.dmr },
    { group: APRS_SLOT_BANK_GROUP_LABELS.amAir, items: grouped.amAir },
    { group: APRS_SLOT_BANK_GROUP_LABELS.fmBroadcast, items: grouped.fmBroadcast },
  ].filter((entry) => entry.group === 'Special' || entry.items.length > 0);
}

export function channelLabelForSlot(slot: AprsChannelSlot, channels: Channel[]): string {
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

export type AprsAssignmentModeFilter = 'digital' | 'analog' | 'both';

export function channelMatchesAprsAssignmentModeFilter(
  channel: Channel,
  filter: AprsAssignmentModeFilter,
): boolean {
  if (filter === 'both') return true;
  const isDigital = channelHasDmrProfile(channel);
  return filter === 'digital' ? isDigital : !isDigital;
}

export function normalizeChannelAprsBindingForSave(
  binding: ChannelAprsBinding | undefined,
  config: AprsConfiguration | null,
): ChannelAprsBinding | undefined {
  const maxSlots = config?.channelSlots.length ?? 0;
  const normalized = normalizeOptionalChannelAprs(binding, [], maxSlots);
  if (binding?.reportSlotIndex != null && maxSlots > 0 && binding.reportSlotIndex > maxSlots) {
    return normalizeOptionalChannelAprs({ ...binding, reportSlotIndex: null }, [], maxSlots);
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

export function channelAssignmentsDirty(
  channels: Channel[],
  draftById: Record<string, ChannelAprsBinding | undefined>,
  aprsConfiguration: AprsConfiguration | null,
): boolean {
  for (const [channelId, draft] of Object.entries(draftById)) {
    const channel = channels.find((c) => c.id === channelId);
    if (!channel) continue;

    const normalizedAprs = normalizeChannelAprsBindingForSave(draft, aprsConfiguration);
    const sameAsLoaded =
      JSON.stringify(normalizedAprs ?? null) === JSON.stringify(channel.aprs ?? null);
    if (!sameAsLoaded) return true;
  }
  return false;
}
