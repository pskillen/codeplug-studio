/**
 * Anytone m×n channel expansion — service façade over the format adapter.
 * App and other non-format callers import from here, not `formats/anytone/`.
 */

import type { ExpandAllMxNChannelsArgs } from '@core/import-export/channelExpansion/mxnExpandAll.ts';
import {
  expandAllAnytoneChannelsForExport,
  resolveAnytoneSiteWireName,
} from '@core/import-export/formats/anytone/channelExpansion.ts';

export { expandAllAnytoneChannelsForExport, resolveAnytoneSiteWireName };
export type { ExpandedAnytoneChannelRow } from '@core/import-export/formats/anytone/channelExpansion.ts';

/** Site wire-name resolver for MxN expansion on Web Serial / preview by radio target. */
export function mxnSiteWireNameResolverForRadioTarget(
  radioTargetId: string,
): ExpandAllMxNChannelsArgs['resolveSiteWireName'] {
  return radioTargetId === 'anytone-at-d890uv' ? resolveAnytoneSiteWireName : undefined;
}
