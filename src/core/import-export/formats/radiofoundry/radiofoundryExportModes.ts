import { expandChannelWireRows } from '@core/import-export/channelExpansion/multiMode.ts';
import type { ExpandedChannelWireRow } from '@core/import-export/channelExpansion/multiMode.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { Channel } from '@core/models/library.ts';
import type { ChannelMode } from '@core/models/libraryTypes.ts';
import {
  pushGeneralInfoWarning,
  pushGeneralWarning,
  type ExportWarning,
} from '@core/import-export/exportWarning.ts';

/** FM and DMR only in a RadioFoundry channel record (byte 0x18). */
export function isRadioFoundryExportableMode(mode: ChannelMode): boolean {
  return mode === 'fm' || mode === 'dmr';
}

export function filterRadioFoundryExportChannel(
  channel: Channel,
  label: string,
  warnings: ExportWarning[] = [],
): Channel | null {
  const supported = channel.modeProfiles.filter((p) => isRadioFoundryExportableMode(p.mode));
  if (supported.length === 0) {
    pushGeneralWarning(
      warnings,
      `Channel "${label}" was dropped. This codeplug stores FM and DMR only.`,
    );
    return null;
  }
  for (const profile of channel.modeProfiles) {
    if (isRadioFoundryExportableMode(profile.mode)) continue;
    pushGeneralInfoWarning(
      warnings,
      `Channel "${label}" mode ${profile.mode} was dropped. This codeplug stores FM and DMR only.`,
    );
  }
  if (supported.length === channel.modeProfiles.length) {
    return channel;
  }
  return { ...channel, modeProfiles: supported };
}

/** Expand multi-mode wire rows after RadioFoundry exportable-mode filtering. */
export function expandRadioFoundryChannelWireRows(
  channel: Channel,
  baseWireName: string | undefined,
  expandModes = true,
  options?: CpsExportOptions,
  profileId?: string,
  reserved = new Set<string>(),
  warnings: ExportWarning[] = [],
  isOverride = false,
): ExpandedChannelWireRow[] {
  const label = baseWireName?.trim() || channel.name;
  const filtered = filterRadioFoundryExportChannel(channel, label, warnings);
  if (!filtered) return [];
  return expandChannelWireRows(
    filtered,
    baseWireName,
    expandModes,
    options,
    profileId,
    reserved,
    warnings,
    isOverride,
  );
}
