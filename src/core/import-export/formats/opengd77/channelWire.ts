import type { ChannelMode, ChannelTone } from '@core/models/libraryTypes.ts';
import { formatFrequencyMhzWireFromHz } from './frequencies.ts';
import { isAnalogMode, isDigitalMode } from './channelModes.ts';
import { DEFAULT_OPENGD77_PROFILE_ID, opengd77PercentToWire } from './profiles.ts';

const NONE_TONE: ChannelTone = 'none';

export function formatOpenGd77PowerWire(
  percent: number | null,
  profileId: string = DEFAULT_OPENGD77_PROFILE_ID,
): string {
  return opengd77PercentToWire(profileId, percent);
}

export function formatOpenGd77SquelchWire(mode: ChannelMode, percent: number | null): string {
  if (isDigitalMode(mode)) return '';
  if (percent == null || percent === 0) return 'Disabled';
  return `${percent}%`;
}

/** Analogue export default when library field is unset (narrowband FM). */
export const OPENGD77_DEFAULT_ANALOG_BANDWIDTH_KHZ = 12.5;

export function formatOpenGd77BandwidthWire(
  khz: number | null,
  isAnalogue: boolean = false,
): string {
  if (khz == null) return isAnalogue ? String(OPENGD77_DEFAULT_ANALOG_BANDWIDTH_KHZ) : '';
  return String(khz);
}

export function formatOpenGd77ColourCodeWire(code: number | null): string {
  if (code == null) return '';
  return String(code);
}

export function formatOpenGd77TimeslotWire(slot: 1 | 2 | null): string {
  if (slot == null) return '';
  return String(slot);
}

export function formatOpenGd77DmrIdWire(mode: ChannelMode, id: number | null): string {
  if (isAnalogMode(mode)) return '';
  if (id == null) return 'None';
  return String(id);
}

export function formatOpenGd77ToneWire(mode: ChannelMode, tone: ChannelTone | null): string {
  if (isDigitalMode(mode)) return '';
  if (tone == null || tone === NONE_TONE) return 'None';
  return tone;
}

export function formatOpenGd77FrequencyWire(hz: number | null): string {
  return formatFrequencyMhzWireFromHz(hz);
}

export function formatOpenGd77TransmitTimeoutWire(seconds: number | null): string {
  if (seconds == null) return '';
  return String(seconds);
}
