/**
 * Anytone CPS thin adapter over the shared radio-target m×n expander.
 * Fan-out maths live in `channelExpansion/mxnExpandAll.ts`; this file only
 * supplies Anytone site wire-name composition.
 */

import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { AssembledBuild, AssembledChannel } from '@core/services/assemble.ts';
import { radioTargetIdForProfile } from '@core/radio-targets/index.ts';
import {
  expandAllMxNChannels,
  expandMxNChannelWireRows,
  expandMxNZoneMemberWireNames,
  mxnExpansionByChannelId,
  mxnPolicyForRadioTarget,
  type ExpandAllMxNChannelsArgs,
  type ExpandedMxNChannelRow,
  type MultiTalkGroupLibrarySlice,
} from '@core/import-export/channelExpansion/mxnExpandAll.ts';
import { anytoneChannelWireName } from './exportChannelWire.ts';

export type ExpandedAnytoneChannelRow = ExpandedMxNChannelRow;
export type AnytoneChannelRowKind = ExpandedMxNChannelRow['rowKind'];

const DEFAULT_RADIO_TARGET = 'anytone-at-d890uv';

function resolveRadioTargetId(assembled: AssembledBuild, options?: CpsExportOptions): string {
  const profileId = options?.profileId ?? assembled.profileId;
  return radioTargetIdForProfile(profileId) ?? DEFAULT_RADIO_TARGET;
}

const resolveAnytoneSiteWireName: NonNullable<ExpandAllMxNChannelsArgs['resolveSiteWireName']> = (
  assembledChannel,
  ctx,
) =>
  anytoneChannelWireName(
    assembledChannel,
    { reserved: ctx.reserved, warnings: ctx.warnings, reserve: !ctx.willExpandRx },
    ctx.options,
    ctx.profileId ?? 'anytone-at-d890uv',
  );

/** Expand one channel into export wire rows (RX-list fan-out + optional scratch). */
export function expandAnytoneChannelWireRows(
  assembledChannel: AssembledChannel,
  assembled: AssembledBuild,
  library: MultiTalkGroupLibrarySlice,
  options?: CpsExportOptions,
  reserved = new Set<string>(),
  warnings: string[] = [],
): ExpandedAnytoneChannelRow[] {
  const radioTargetId = resolveRadioTargetId(assembled, options);
  const policy = mxnPolicyForRadioTarget(radioTargetId);
  if (!policy) {
    return expandAllMxNChannels({
      assembled: { ...assembled, channels: [assembledChannel] },
      library,
      radioTargetId,
      options,
      warnings,
      resolveSiteWireName: resolveAnytoneSiteWireName,
    });
  }
  return expandMxNChannelWireRows(
    assembledChannel,
    assembled,
    library,
    policy,
    options,
    reserved,
    warnings,
    resolveAnytoneSiteWireName,
  );
}

/** Expand all assembled channels for Anytone export, preserving order. */
export function expandAllAnytoneChannelsForExport(
  assembled: AssembledBuild,
  library: MultiTalkGroupLibrarySlice,
  options?: CpsExportOptions,
  warnings: string[] = [],
): ExpandedAnytoneChannelRow[] {
  return expandAllMxNChannels({
    assembled,
    library,
    radioTargetId: resolveRadioTargetId(assembled, options),
    options,
    warnings,
    resolveSiteWireName: resolveAnytoneSiteWireName,
  });
}

/** Map channel id → expanded wire rows for zone member resolution. */
export function anytoneChannelExpansionById(
  expandedRows: ExpandedAnytoneChannelRow[],
): Map<string, ExpandedAnytoneChannelRow[]> {
  return mxnExpansionByChannelId(expandedRows);
}

/** Zone member wire names aligned with expanded channel rows. */
export function expandAnytoneZoneMemberWireNames(
  memberChannelIds: string[],
  expansionByChannelId: Map<string, ExpandedAnytoneChannelRow[]>,
): string[] {
  return expandMxNZoneMemberWireNames(memberChannelIds, expansionByChannelId);
}

export type { MultiTalkGroupLibrarySlice };
