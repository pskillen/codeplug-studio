import type { Channel } from '@core/models/library.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { getOpenGd77Profile } from '@core/import-export/formats/opengd77/profiles.ts';
import {
  channelPickForWireExport,
  composeChannelWireName,
  type ChannelExportNameMode,
} from '@core/domain/channelNaming.ts';
import { finalizeWireName, uniqueWireName } from './shortenName.ts';

export function resolveMaxNameLength(
  profileId: string | undefined,
  options?: CpsExportOptions,
): number | undefined {
  if (options?.maxNameLength != null) return options.maxNameLength;
  if (!profileId) return undefined;
  return getOpenGd77Profile(profileId).nameLimit;
}

export function composeExportWireName(
  channel: Channel,
  options?: CpsExportOptions,
): string {
  const pick = channelPickForWireExport(channel, {
    nameModeOverride: options?.nameModeOverride as ChannelExportNameMode | undefined,
    useChannelAbbreviation: options?.useChannelAbbreviation,
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
    const name = uniqueWireName(baseWireName, reserved);
    reserved.add(name);
    if (maxLen != null && name.length > maxLen) {
      warnings.push(`Channel name "${name}" exceeds ${maxLen} characters`);
    }
    return name;
  }

  const pick = channelPickForWireExport(channel, {
    nameModeOverride: options?.nameModeOverride as ChannelExportNameMode | undefined,
    useChannelAbbreviation: options?.useChannelAbbreviation,
  });

  return finalizeWireName(
    baseWireName,
    reserved,
    maxLen,
    {
      exportNameMode: pick.exportNameMode,
      recomposeWithMode: (mode) => composeChannelWireName({ ...pick, exportNameMode: mode }),
    },
    warnings,
  );
}
