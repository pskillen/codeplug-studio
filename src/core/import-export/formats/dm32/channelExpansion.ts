/**
 * DM32 CPS thin adapter over the shared radio-target m×n expander.
 * Fan-out maths live in `channelExpansion/mxnExpandAll.ts`.
 */

import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { AssembledBuild, AssembledChannel } from '@core/services/assemble.ts';
import { radioTargetIdForProfile } from '@core/radio-targets/index.ts';
import { filterExpandedRowsByOverrides } from '@core/domain/formatBuildOverrides.ts';
import {
  expandAllMxNChannels,
  expandMxNChannelWireRows,
  expandMxNZoneMemberWireNames,
  mxnExpansionByChannelId,
  mxnPolicyForRadioTarget,
  type ExpandedMxNChannelRow,
  type MultiTalkGroupLibrarySlice,
} from '@core/import-export/channelExpansion/mxnExpandAll.ts';

export type ExpandedDm32ChannelRow = ExpandedMxNChannelRow;
export type Dm32ChannelRowKind = ExpandedMxNChannelRow['rowKind'];

const DEFAULT_RADIO_TARGET = 'baofeng-dm32uv';

function resolveRadioTargetId(assembled: AssembledBuild, options?: CpsExportOptions): string {
  const profileId = options?.profileId ?? assembled.profileId;
  return radioTargetIdForProfile(profileId) ?? DEFAULT_RADIO_TARGET;
}

function withProjectionExclusions(
  rows: ExpandedDm32ChannelRow[],
  options?: CpsExportOptions,
): ExpandedDm32ChannelRow[] {
  return filterExpandedRowsByOverrides(rows, options?.channelOverrides);
}

/** Expand one channel into export wire rows (RX-list fan-out + optional scratch). */
export function expandDm32ChannelWireRows(
  assembledChannel: AssembledChannel,
  assembled: AssembledBuild,
  library: MultiTalkGroupLibrarySlice,
  options?: CpsExportOptions,
  reserved = new Set<string>(),
  warnings: string[] = [],
): ExpandedDm32ChannelRow[] {
  const radioTargetId = resolveRadioTargetId(assembled, options);
  const policy = mxnPolicyForRadioTarget(radioTargetId);
  const rows = !policy
    ? expandAllMxNChannels({
        assembled: { ...assembled, channels: [assembledChannel] },
        library,
        radioTargetId,
        options,
        warnings,
      })
    : expandMxNChannelWireRows(
        assembledChannel,
        assembled,
        library,
        policy,
        options,
        reserved,
        warnings,
      );
  return withProjectionExclusions(rows, options);
}

/** Expand all assembled channels for DM32 export, preserving order. */
export function expandAllDm32ChannelsForExport(
  assembled: AssembledBuild,
  library: MultiTalkGroupLibrarySlice,
  options?: CpsExportOptions,
  warnings: string[] = [],
): ExpandedDm32ChannelRow[] {
  return withProjectionExclusions(
    expandAllMxNChannels({
      assembled,
      library,
      radioTargetId: resolveRadioTargetId(assembled, options),
      options,
      warnings,
    }),
    options,
  );
}

/** Map channel id → expanded wire rows for zone member resolution. */
export function dm32ChannelExpansionById(
  expandedRows: ExpandedDm32ChannelRow[],
): Map<string, ExpandedDm32ChannelRow[]> {
  return mxnExpansionByChannelId(expandedRows);
}

/** Zone member wire names aligned with expanded channel rows. */
export function expandDm32ZoneMemberWireNames(
  memberChannelIds: string[],
  expansionByChannelId: Map<string, ExpandedDm32ChannelRow[]>,
): string[] {
  return expandMxNZoneMemberWireNames(memberChannelIds, expansionByChannelId);
}

export type { MultiTalkGroupLibrarySlice };
