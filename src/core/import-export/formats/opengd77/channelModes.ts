import type { ChannelMode } from '@core/models/libraryTypes.ts';

const ANALOG_MODES = new Set<ChannelMode>(['fm', 'am', 'ssb-usb', 'ssb-lsb']);
const DIGITAL_MODES = new Set<ChannelMode>(['dmr', 'ysf', 'dstar', 'p25', 'nxdn', 'm17', 'tetra']);

export function isAnalogMode(mode: ChannelMode): boolean {
  return ANALOG_MODES.has(mode);
}

export function isDigitalMode(mode: ChannelMode): boolean {
  return DIGITAL_MODES.has(mode);
}

/** Map internal mode to OpenGD77 `Channel Type` wire value. */
export function mapModeToOpenGd77ChannelType(mode: ChannelMode): string {
  if (isAnalogMode(mode)) return 'Analogue';
  if (isDigitalMode(mode)) return 'Digital';
  return mode;
}
