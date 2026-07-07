import {
  channelPickForWireExport,
  composeChannelWireName,
  type ChannelExportNameMode,
} from '@core/domain/channelNaming.ts';
import { applyWireNameLimits } from '@core/import-export/channelExpansion/exportWireNames.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { Channel } from '@core/models/library.ts';
import { mergeExportOptions } from './exportBuild.ts';

/** Generated CPS wire name for build wire-preview UI — mirrors export shortening and name mode. */
export function previewGeneratedChannelWireName(
  channel: Channel,
  build: FormatBuild,
  options?: CpsExportOptions,
): string {
  const merged = options ?? mergeExportOptions(build);
  const profileId = merged.profileId ?? build.profileId;
  const reserved = new Set<string>();
  const warnings: string[] = [];
  const pick = channelPickForWireExport(channel, {
    nameModeOverride: merged.nameModeOverride as ChannelExportNameMode | undefined,
  });
  let base = composeChannelWireName(pick);
  const abbrev = channel.abbreviation?.trim();
  if (abbrev && merged.useChannelAbbreviation !== false) {
    base = composeChannelWireName({ ...pick, name: abbrev });
  }
  return applyWireNameLimits(base, channel, reserved, merged, profileId, warnings);
}
