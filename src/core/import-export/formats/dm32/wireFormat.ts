import type { ChannelTone, DMRTimeSlot } from '@core/models/libraryTypes.ts';
import type { ChannelMode, ChannelModeProfile } from '@core/models/library.ts';
import {
  DEFAULT_DM32_PROFILE_ID,
  dm32PercentToSquelchWire,
  dm32PercentToWire,
} from './profiles.ts';
import { isAnalogMode, isDmrMode } from './channelModes.ts';

export function formatDm32BandwidthWire(khz: number | null): string {
  if (khz == null) return '12.5KHz';
  if (Math.abs(khz - 25) < 0.01) return '25KHz';
  return '12.5KHz';
}

export function formatDm32TimeslotWire(slot: DMRTimeSlot | null): string {
  if (slot === 2) return 'Slot 2';
  return 'Slot 1';
}

export function formatDm32FlagWire(value: boolean): string {
  return value ? '1' : '0';
}

export function formatDm32ToneWire(tone: ChannelTone): string {
  if (tone === 'none') return 'None';
  return tone;
}

export function formatDm32ChannelTypeWire(
  mode: ChannelMode,
  multiMode: boolean,
  modeProfiles: ChannelModeProfile[],
): string {
  if (!multiMode || modeProfiles.length < 2) {
    if (isAnalogMode(mode)) return 'Analog';
    if (isDmrMode(mode)) return 'Digital';
    return 'Analog';
  }
  const hasFm = modeProfiles.some((p) => isAnalogMode(p.mode));
  const hasDmr = modeProfiles.some((p) => isDmrMode(p.mode));
  if (hasFm && hasDmr) {
    return isDmrMode(mode) ? 'Fixed Digital' : 'Fixed Analog';
  }
  if (isDmrMode(mode)) return 'Digital';
  return 'Analog';
}

export function formatDm32FrequencyWire(hz: number | null): string {
  if (hz == null) return '';
  return (hz / 1_000_000).toFixed(5);
}

export function formatDm32PowerWire(
  percent: number | null,
  profileId: string = DEFAULT_DM32_PROFILE_ID,
): string {
  return dm32PercentToWire(profileId, percent);
}

export function formatDm32SquelchWire(
  percent: number | null,
  profileId: string = DEFAULT_DM32_PROFILE_ID,
  options: { isAnalog?: boolean } = {},
): string {
  if (percent == null && options.isAnalog) {
    return '1';
  }
  return dm32PercentToSquelchWire(profileId, percent);
}

export function formatDm32TxAdmitWire(): string {
  return 'Channel Idle';
}
