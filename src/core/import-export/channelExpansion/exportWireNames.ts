import type { Channel } from '@core/models/library.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { getDm32Profile } from '@core/import-export/formats/dm32/profiles.ts';
import { getOpenGd77Profile } from '@core/import-export/formats/opengd77/profiles.ts';
import {
  channelPickForWireExport,
  composeChannelWireName,
  type ChannelExportNameMode,
} from '@core/domain/channelNaming.ts';
import { finalizeWireName, uniqueWireName } from './shortenName.ts';
import { sanitiseAsciiWireString } from '../sanitiseAsciiWireString.ts';

export function resolveMaxNameLength(
  profileId: string | undefined,
  options?: CpsExportOptions,
): number | undefined {
  if (options?.maxNameLength != null) return options.maxNameLength;
  if (!profileId) return undefined;
  if (profileId.startsWith('dm32-')) return getDm32Profile(profileId).nameLimit;
  if (profileId.startsWith('opengd77-')) return getOpenGd77Profile(profileId).nameLimit;
  try {
    return getOpenGd77Profile(profileId).nameLimit;
  } catch {
    return getDm32Profile(profileId).nameLimit;
  }
}

export function composeExportWireName(channel: Channel, options?: CpsExportOptions): string {
  const pick = channelPickForWireExport(channel, {
    nameModeOverride: options?.nameModeOverride as ChannelExportNameMode | undefined,
  });
  return composeChannelWireName(pick);
}

export function applyWireNameLimits(
  baseWireName: string,
  channel: Channel,
  reserved: Set<string>,
  options: CpsExportOptions | undefined,
  profileId: string | undefined,
  warnings: string[],
): string {
  const maxLen = resolveMaxNameLength(profileId ?? options?.profileId, options);
  const shorten = options?.shortenNames !== false;

  if (!shorten || maxLen == null) {
    const name = sanitiseAsciiWireString(uniqueWireName(baseWireName, reserved));
    reserved.add(name);
    if (maxLen != null && name.length > maxLen) {
      warnings.push(`Channel name "${name}" exceeds ${maxLen} characters`);
    }
    return name;
  }

  const pick = channelPickForWireExport(channel, {
    nameModeOverride: options?.nameModeOverride as ChannelExportNameMode | undefined,
  });
  const abbrev = channel.abbreviation?.trim();
  const recomposeWithChannelAbbreviation =
    abbrev && options?.useChannelAbbreviation !== false
      ? () => composeChannelWireName({ ...pick, name: abbrev })
      : undefined;

  return sanitiseAsciiWireString(
    finalizeWireName(
      baseWireName,
      reserved,
      maxLen,
      {
        exportNameMode: pick.exportNameMode,
        recomposeWithMode: (mode) => composeChannelWireName({ ...pick, exportNameMode: mode }),
        recomposeWithChannelAbbreviation,
      },
      warnings,
    ),
  );
}
