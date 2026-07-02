import type { ChannelMode } from '@core/models/libraryTypes.ts';
import { isAnalogMode } from '@core/import-export/formats/opengd77/channelModes.ts';

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
