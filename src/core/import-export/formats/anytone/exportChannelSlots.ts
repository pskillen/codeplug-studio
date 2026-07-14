import type { AssembledBuild } from '@core/services/assemble.ts';
import type { ExpandedAnytoneChannelRow } from './channelExpansion.ts';
import { isZoneScanCarrierChannelId } from '@core/import-export/zoneDerivedScanLists/carrier.ts';
import type { AnytonePreparedExport } from './prepareExportAssembly.ts';
import { partitionAnytoneChannels } from './receiveOnlyBanks.ts';

/** DMR channel rows in export order (matches Channel.CSV serialisation). */
export function orderedDmrExpandedRows(
  assembled: AssembledBuild,
  prepared: AnytonePreparedExport,
): ExpandedAnytoneChannelRow[] {
  const { dmrChannels } = partitionAnytoneChannels(assembled);
  const dmrChannelIds = new Set(dmrChannels.map((row) => row.entity.id));
  const ordered: ExpandedAnytoneChannelRow[] = [];
  for (const assembledChannel of assembled.channels) {
    const channelId = assembledChannel.entity.id;
    if (!dmrChannelIds.has(channelId) && !isZoneScanCarrierChannelId(channelId)) continue;
    const expanded = prepared.expansionByChannelId.get(channelId);
    if (expanded?.length) ordered.push(...expanded);
  }
  return ordered;
}
