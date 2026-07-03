import type { ChannelMode } from '@core/models/libraryTypes.ts';

const ANALOG_MODES = new Set<ChannelMode>(['fm', 'am', 'ssb-usb', 'ssb-lsb']);

export function isAnalogMode(mode: ChannelMode): boolean {
  return ANALOG_MODES.has(mode);
}

export function isDmrMode(mode: ChannelMode): boolean {
  return mode === 'dmr';
}
