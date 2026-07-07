import type { ChannelTone } from '@core/models/library.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import { anytonePercentToWire } from './profiles.ts';

export function formatAnytoneFrequencyMHz(hz: number | null): string {
  if (hz == null || !Number.isFinite(hz)) return '0.00000';
  return (hz / 1_000_000).toFixed(5);
}

export function formatAnytoneBandwidthKhz(khz: number | null): string {
  if (khz == null) return '12.5K';
  return `${khz}K`;
}

export function formatAnytoneToneWire(tone: ChannelTone | undefined): string {
  if (!tone || tone === 'none') return 'Off';
  if (typeof tone === 'number') return String(tone);
  return String(tone);
}

export function formatAnytoneChannelType(mode: string): string {
  if (mode === 'dmr') return 'D-Digital';
  if (mode === 'fm' || mode === 'am') return 'A-Analog';
  return 'D-Digital';
}

export function formatAnytonePowerWire(profileId: string, percent: number | null): string {
  return anytonePercentToWire(profileId, percent);
}

export function formatAnytoneTimeslot(timeslot: 1 | 2 | null | undefined): string {
  return String(timeslot ?? 1);
}

export function resolveEntityWireName(
  assembled: AssembledBuild,
  ref: { kind: string; id: string } | null | undefined,
): { name: string; callType: string; digitalId: string } {
  if (!ref) {
    return { name: '', callType: 'Group Call', digitalId: '' };
  }
  if (ref.kind === 'talkGroup') {
    const tg = assembled.talkGroups.find((row) => row.entity.id === ref.id);
    return {
      name: tg?.wireName ?? '',
      callType: 'Group Call',
      digitalId: tg ? String(tg.entity.digitalId) : '',
    };
  }
  if (ref.kind === 'digitalContact') {
    const contact = assembled.digitalContacts.find((row) => row.entity.id === ref.id);
    return {
      name: contact?.wireName ?? '',
      callType: 'Private Call',
      digitalId: contact ? String(contact.entity.digitalId) : '',
    };
  }
  return { name: '', callType: 'Group Call', digitalId: '' };
}

export function resolveRxGroupListWireName(
  assembled: AssembledBuild,
  listId: string | null | undefined,
): string {
  if (!listId) return 'None';
  const list = assembled.rxGroupLists.find((row) => row.entity.id === listId);
  return list?.wireName ?? 'None';
}
