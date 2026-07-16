import type { Channel, ChannelTone } from '@core/models/library.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import type {
  AnalogSquelchMode,
  SendTalkerAliasMode,
  TxPermitMode,
} from '@core/models/channelBehaviourDefaults.ts';
import {
  type ChannelBehaviourContext,
  resolveEffectiveTxPermit,
} from '@core/import-export/channelBehaviourDefaults/index.ts';
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
 * Map resolved analog squelch mode to Anytone `Squelch Mode` wire string.
 */
export function formatAnytoneSquelchModeFromResolved(
  mode: AnalogSquelchMode,
): 'Carrier' | 'CTCSS/DCS' {
  return mode === 'tone' ? 'CTCSS/DCS' : 'Carrier';
}

/** @deprecated Use `formatAnytoneSquelchModeFromResolved` with cascade resolution. */
export function formatAnytoneSquelchMode(rxTone: ChannelTone | undefined): 'Carrier' | 'CTCSS/DCS' {
  if (!rxTone || rxTone === 'none') return 'Carrier';
  return 'CTCSS/DCS';
}

export function formatAnytoneTalkerAliasWire(mode: SendTalkerAliasMode): '0' | '1' {
  return mode === 'on' ? '1' : '0';
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

export type AnytoneBusyLockWire = 'Channel Free' | 'ChannelFree' | 'Off' | 'Always';

function isAnytoneAnalogTxPrimary(channelType: string): boolean {
  return channelType === 'A-Analog' || channelType === 'A+D TX A';
}

/**
 * Map resolved `txPermit` + TX-primary channel type to `Busy Lock/TX Permit` wire.
 * CPS-only variants (`Different CDT`, colour-code admits) are intentionally unmodelled.
 */
export function formatAnytoneBusyLockTxPermit(
  channel: Pick<Channel, 'modeProfiles' | 'primaryMode' | 'txPermit'>,
  context?: ChannelBehaviourContext,
): AnytoneBusyLockWire {
  const txPermit = resolveEffectiveTxPermit(channel, context);
  const channelType = formatAnytoneChannelTypeFromChannel(channel);
  const analogTx = isAnytoneAnalogTxPrimary(channelType);

  if (txPermit === 'busyLock') {
    return analogTx ? 'Channel Free' : 'ChannelFree';
  }
  return analogTx ? 'Off' : 'Always';
}

/** @internal — test helper for mapping table assertions. */
export function formatAnytoneBusyLockFromTxPermit(
  txPermit: TxPermitMode,
  channelType: string,
): AnytoneBusyLockWire {
  const analogTx = isAnytoneAnalogTxPrimary(channelType);
  if (txPermit === 'busyLock') {
    return analogTx ? 'Channel Free' : 'ChannelFree';
  }
  return analogTx ? 'Off' : 'Always';
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
