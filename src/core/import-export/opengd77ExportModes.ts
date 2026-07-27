import { expandChannelWireRows } from '@core/import-export/channelExpansion/multiMode.ts';
import type { ExpandedChannelWireRow } from '@core/import-export/channelExpansion/multiMode.ts';
import { isAnalogMode } from '@core/import-export/formats/opengd77/channelModes.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { Channel } from '@core/models/library.ts';
import type { ChannelMode } from '@core/models/libraryTypes.ts';

/** FM+DMR only for modelled OpenGD77 radios (1701 / MD-9600). */
export function isOpenGd77ExportableMode(mode: ChannelMode): boolean {
  return isAnalogMode(mode) || mode === 'dmr';
}

export function openGd77DroppedModesWarning(
  channelLabel: string,
  modes: readonly ChannelMode[],
): string {
  return `Channel "${channelLabel}": dropped unsupported digital mode(s) for OpenGD77: ${modes.join(', ')}`;
}

export function openGd77OmittedChannelWarning(channelLabel: string): string {
  return `Channel "${channelLabel}": omitted from OpenGD77 export (no FM/DMR mode profiles)`;
}

/**
 * Filter library mode profiles to FM/analogue + DMR for OpenGD77 export / Write.
 * Returns null when no exportable profiles remain (caller should skip the channel).
 */
export function filterOpenGd77ExportChannel(
  channel: Channel,
  warnings: string[] = [],
): Channel | null {
  const dropped = channel.modeProfiles.filter((p) => !isOpenGd77ExportableMode(p.mode));
  if (dropped.length > 0) {
    warnings.push(
      openGd77DroppedModesWarning(
        channel.name,
        dropped.map((p) => p.mode),
      ),
    );
  }
  const exportableProfiles = channel.modeProfiles.filter((p) => isOpenGd77ExportableMode(p.mode));
  if (exportableProfiles.length === 0) {
    warnings.push(openGd77OmittedChannelWarning(channel.name));
    return null;
  }
  if (exportableProfiles.length === channel.modeProfiles.length) {
    return channel;
  }
  return { ...channel, modeProfiles: exportableProfiles };
}

/** Expand multi-mode wire rows after OpenGD77 exportable-mode filtering. */
export function expandOpenGd77ChannelWireRows(
  channel: Channel,
  baseWireName: string | undefined,
  expandModes = true,
  options?: CpsExportOptions,
  profileId?: string,
  reserved = new Set<string>(),
  warnings: string[] = [],
): ExpandedChannelWireRow[] {
  const filtered = filterOpenGd77ExportChannel(channel, warnings);
  if (!filtered) return [];
  return expandChannelWireRows(
    filtered,
    baseWireName,
    expandModes,
    options,
    profileId,
    reserved,
    warnings,
  );
}
