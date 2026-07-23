/**
 * NeonPlug DM32UV thin adapter over the shared radio-target m×n expander.
 * Fan-out maths live in `channelExpansion/mxnExpandAll.ts`.
 */

import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { AssembledBuild, AssembledChannel } from '@core/services/assemble.ts';
import { radioTargetIdForProfile } from '@core/radio-targets/index.ts';
import {
  expandAllMxNChannels,
  expandMxNChannelWireRows,
  expandMxNZoneMemberNumbers,
  mxnExpansionByChannelId,
  mxnPolicyForRadioTarget,
  type ExpandedMxNChannelRow,
  type MultiTalkGroupLibrarySlice,
} from '@core/import-export/channelExpansion/mxnExpandAll.ts';

/** Same radio family as DM32 CPS — `ALL` is a sentinel listen-all list, not expandable members. */
export const NEONPLUG_NON_EXPANDABLE_RX_GROUP_LISTS = ['ALL'] as const;

export type ExpandedNeonplugChannelRow = ExpandedMxNChannelRow;
export type NeonplugChannelRowKind = ExpandedMxNChannelRow['rowKind'];

const DEFAULT_RADIO_TARGET = 'baofeng-dm32uv';

function resolveRadioTargetId(assembled: AssembledBuild, options?: CpsExportOptions): string {
  const profileId = options?.profileId ?? assembled.profileId;
  return radioTargetIdForProfile(profileId) ?? DEFAULT_RADIO_TARGET;
}

/** Expand one channel into export rows (RX-list fan-out + optional scratch). */
export function expandNeonplugChannelWireRows(
  assembledChannel: AssembledChannel,
  assembled: AssembledBuild,
  library: MultiTalkGroupLibrarySlice,
  options?: CpsExportOptions,
  reserved = new Set<string>(),
  warnings: string[] = [],
): ExpandedNeonplugChannelRow[] {
  const radioTargetId = resolveRadioTargetId(assembled, options);
  const policy = mxnPolicyForRadioTarget(radioTargetId);
  if (!policy) {
    return expandAllMxNChannels({
      assembled: { ...assembled, channels: [assembledChannel] },
      library,
      radioTargetId,
      options,
      warnings,
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
  );
}

/** Expand all assembled channels for NeonPlug DM32UV export, preserving order. */
export function expandAllNeonplugChannelsForExport(
  assembled: AssembledBuild,
  library: MultiTalkGroupLibrarySlice,
  options?: CpsExportOptions,
  warnings: string[] = [],
): ExpandedNeonplugChannelRow[] {
  return expandAllMxNChannels({
    assembled,
    library,
    radioTargetId: resolveRadioTargetId(assembled, options),
    options,
    warnings,
  });
}

/** Map channel id → expanded rows for zone / scan member resolution. */
export function neonplugChannelExpansionById(
  expandedRows: ExpandedNeonplugChannelRow[],
): Map<string, ExpandedNeonplugChannelRow[]> {
  return mxnExpansionByChannelId(expandedRows);
}

/**
 * Zone / scan member channel **numbers** aligned with expanded export rows.
 * `numbersBySourceChannelId` maps each library channel UUID to its projected NeonPlug numbers.
 */
export function expandNeonplugZoneMemberNumbers(
  memberChannelIds: readonly string[],
  numbersBySourceChannelId: ReadonlyMap<string, readonly number[]>,
): number[] {
  return expandMxNZoneMemberNumbers(memberChannelIds, numbersBySourceChannelId);
}

export type { MultiTalkGroupLibrarySlice };
