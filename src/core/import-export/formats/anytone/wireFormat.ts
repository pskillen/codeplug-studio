import type { Channel, ChannelTone } from '@core/models/library.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import { resolveChannelPrimaryMode } from '@core/domain/modeProfiles.ts';
import { resolveDmrOperatingMode } from '@core/domain/dmrOperatingMode.ts';
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

/**
 * Derive `Squelch Mode` from analog RX tone (#394).
 * `CTCSS/DCS` when RX tone is set; otherwise `Carrier` (digital-only / no tone).
 */
export function formatAnytoneSquelchMode(rxTone: ChannelTone | undefined): 'Carrier' | 'CTCSS/DCS' {
  if (!rxTone || rxTone === 'none') return 'Carrier';
  return 'CTCSS/DCS';
}

export function formatAnytoneChannelType(mode: string): string {
  if (mode === 'dmr') return 'D-Digital';
  if (mode === 'fm' || mode === 'am') return 'A-Analog';
  return 'D-Digital';
}

function channelHasAnytoneAnalogProfile(channel: Pick<Channel, 'modeProfiles'>): boolean {
  return channel.modeProfiles.some((profile) => profile.mode === 'fm' || profile.mode === 'am');
}

function channelHasDmrProfile(channel: Pick<Channel, 'modeProfiles'>): boolean {
  return channel.modeProfiles.some((profile) => profile.mode === 'dmr');
}

/** Map library channel modes + primary to Anytone `Channel Type` wire string. */
export function formatAnytoneChannelTypeFromChannel(
  channel: Pick<Channel, 'modeProfiles' | 'primaryMode'>,
): string {
  const hasDmr = channelHasDmrProfile(channel);
  const hasAnalog = channelHasAnytoneAnalogProfile(channel);

  if (hasDmr && hasAnalog) {
    const primary = resolveChannelPrimaryMode(channel);
    if (primary === 'fm' || primary === 'am') return 'A+D TX A';
    return 'D+A TX D';
  }
  if (hasDmr) return 'D-Digital';
  if (hasAnalog) return 'A-Analog';
  return formatAnytoneChannelType(channel.modeProfiles[0]?.mode ?? 'dmr');
}

/**
 * Provisional `Busy Lock/TX Permit` until a library field lands (#396 / #388).
 * Analog TX primary → `Channel Free`; digital TX primary → `ChannelFree`.
 */
export function formatAnytoneBusyLockTxPermit(
  channel: Pick<Channel, 'modeProfiles' | 'primaryMode'>,
): 'Channel Free' | 'ChannelFree' {
  const channelType = formatAnytoneChannelTypeFromChannel(channel);
  if (channelType === 'A-Analog' || channelType === 'A+D TX A') {
    return 'Channel Free';
  }
  return 'ChannelFree';
}

/** Map DMR operating mode to Anytone `DMR MODE` wire digit. */
export function formatAnytoneDmrModeWire(
  channel: Pick<Channel, 'rxFrequency' | 'txFrequency' | 'modeProfiles'>,
): '0' | '1' {
  return resolveDmrOperatingMode(channel) === 'repeater' ? '1' : '0';
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
