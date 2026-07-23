import {
  channelPickForWireExport,
  composeChannelWireName,
  type ChannelExportNameMode,
} from '@core/domain/channelNaming.ts';
import { applyWireNameLimits } from '@core/import-export/channelExpansion/exportWireNames.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { Channel } from '@core/models/library.ts';
import { defaultCompatibleEgress } from '@core/radio-targets/index.ts';
import { mergeExportOptions } from './exportBuild.ts';

/**
 * Wire-preview export options — {@link CpsExportOptions} plus an optional egress `formatId`
 * override. When omitted, `formatId`/`profileId` default via the build's radio target
 * ({@link defaultCompatibleEgress}) since `RadioBuild` no longer carries these fields (#654).
 */
export interface WirePreviewChannelNameOptions extends CpsExportOptions {
  /** Egress format id override — defaults to the radio target's default compatible egress. */
  formatId?: string;
}

/** Generated CPS wire name for build wire-preview UI — mirrors export shortening and name mode. */
export function previewGeneratedChannelWireName(
  channel: Channel,
  build: RadioBuild,
  options?: WirePreviewChannelNameOptions,
): string {
  const defaultEgress = defaultCompatibleEgress(build.radioTargetId);
  const formatId = options?.formatId ?? defaultEgress?.formatId ?? '';
  const merged = options ?? mergeExportOptions(build, formatId);
  const profileId = merged.profileId ?? defaultEgress?.profileId;
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
