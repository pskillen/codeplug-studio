import type { Channel, ChannelModeProfile } from '@core/models/library.ts';
import type { ChannelMode } from '@core/models/libraryTypes.ts';
import { isAnalogMode } from '@core/import-export/formats/opengd77/channelModes.ts';

export interface ExpandedChannelWireRow {
  sourceChannelId: string;
  /** Override storage key — channel id or `${channelId}:-F` / `:-D`. */
  key: string;
  wireName: string;
  mode: ChannelMode;
  modeProfile: ChannelModeProfile;
}

/** Suffix for derived export wire names per mode category (OpenGD77 multi-mode). */
export function modeExportNameSuffix(mode: ChannelMode): string {
  return isAnalogMode(mode) ? '-F' : '-D';
}

export function expansionWireKey(channelId: string, mode: ChannelMode): string {
  return `${channelId}:${modeExportNameSuffix(mode)}`;
}

function modeProfileForChannel(channel: Channel): ChannelModeProfile {
  const profile = channel.modeProfiles[0];
  if (profile) return profile;
  return { mode: 'fm', squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: null };
}

/**
 * Expand one assembled channel into one or more export wire rows.
 * When `expandModes` is true and multiple mode profiles exist, emits `-F`/`-D` suffixed names.
 */
export function expandChannelWireRows(
  channel: Channel,
  baseWireName: string,
  expandModes = true,
): ExpandedChannelWireRow[] {
  const profiles = channel.modeProfiles.length > 0 ? channel.modeProfiles : [modeProfileForChannel(channel)];

  if (!expandModes || profiles.length <= 1) {
    const profile = profiles[0]!;
    return [
      {
        sourceChannelId: channel.id,
        key: channel.id,
        wireName: baseWireName,
        mode: profile.mode,
        modeProfile: profile,
      },
    ];
  }

  return profiles.map((profile) => {
    const suffix = modeExportNameSuffix(profile.mode);
    return {
      sourceChannelId: channel.id,
      key: expansionWireKey(channel.id, profile.mode),
      wireName: `${baseWireName}${suffix}`,
      mode: profile.mode,
      modeProfile: profile,
    };
  });
}

/** Expand zone member channel ids to export wire names (multi-mode fan-out). */
export function expandZoneMemberWireNames(
  memberChannelIds: string[],
  channelById: Map<string, Channel>,
  wireNameByChannelId: Map<string, string>,
  expandModes = true,
): string[] {
  const names: string[] = [];
  for (const channelId of memberChannelIds) {
    const channel = channelById.get(channelId);
    if (!channel) continue;
    const baseWireName = wireNameByChannelId.get(channelId) ?? channel.name;
    const rows = expandChannelWireRows(channel, baseWireName, expandModes);
    for (const row of rows) {
      names.push(row.wireName);
    }
  }
  return names;
}

export function buildExpandedChannelWireMap(
  channels: Array<{ entity: Channel; wireName: string }>,
  expandModes = true,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of channels) {
    for (const expanded of expandChannelWireRows(row.entity, row.wireName, expandModes)) {
      map.set(expanded.key, expanded.wireName);
      if (expanded.key === row.entity.id) {
        map.set(row.entity.id, expanded.wireName);
      }
    }
  }
  return map;
}
