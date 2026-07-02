import type { ChannelMode } from '@core/models/libraryTypes.ts';
import { isAnalogMode } from '@core/import-export/formats/opengd77/channelModes.ts';

/** Longest first so `-DS` wins over `-D`. */
export const MODE_EXPORT_NAME_SUFFIXES = [
  '-P25',
  '-M17',
  '-DS',
  '-NX',
  '-D',
  '-F',
  '-Y',
  '-T',
] as const;

export function peelModeExportSuffix(name: string): { stem: string; suffix: string } {
  for (const suffix of MODE_EXPORT_NAME_SUFFIXES) {
    if (name.endsWith(suffix)) {
      return { stem: name.slice(0, -suffix.length), suffix };
    }
  }
  return { stem: name, suffix: '' };
}

/** Suffix for derived export wire names per mode (multi-mode channel expansion). */
export function modeExportNameSuffix(mode: ChannelMode): string {
  if (isAnalogMode(mode)) return '-F';
  switch (mode) {
    case 'dmr':
      return '-D';
    case 'dstar':
      return '-DS';
    case 'ysf':
      return '-Y';
    case 'p25':
      return '-P25';
    case 'nxdn':
      return '-NX';
    case 'm17':
      return '-M17';
    case 'tetra':
      return '-T';
    default:
      return '-D';
  }
}

export function expansionWireKey(channelId: string, mode: ChannelMode): string {
  return `${channelId}:${modeExportNameSuffix(mode)}`;
}
