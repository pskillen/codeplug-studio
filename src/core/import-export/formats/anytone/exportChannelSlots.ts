import type { AssembledBuild, AssembledChannel } from '@core/services/assemble.ts';
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

export function sortReceiveBankChannels(channels: AssembledChannel[]): AssembledChannel[] {
  return [...channels].sort((a, b) => {
    const slotA = a.orderOrSlot ?? Number.MAX_SAFE_INTEGER;
    const slotB = b.orderOrSlot ?? Number.MAX_SAFE_INTEGER;
    if (slotA !== slotB) return slotA - slotB;
    return a.wireName.localeCompare(b.wireName);
  });
}

export function receiveBankChannelSlot(row: AssembledChannel, index: number): number {
  return row.orderOrSlot ?? index + 1;
}

function buildSlotByIdFromOrdered(ordered: AssembledChannel[]): Map<string, number> {
  const slotById = new Map<string, number>();
  ordered.forEach((row, index) => {
    slotById.set(row.entity.id, receiveBankChannelSlot(row, index));
  });
  return slotById;
}

export function orderedAmAirChannels(assembled: AssembledBuild): AssembledChannel[] {
  const { amAirChannels } = partitionAnytoneChannels(assembled);
  return sortReceiveBankChannels(amAirChannels);
}

export function orderedFmBroadcastChannels(assembled: AssembledBuild): AssembledChannel[] {
  const { fmBroadcastChannels } = partitionAnytoneChannels(assembled);
  return sortReceiveBankChannels(fmBroadcastChannels);
}

/** Channel.CSV `No.` index by library channel id (DMR / main bank). */
export function resolveDmrChannelSlotById(
  assembled: AssembledBuild,
  prepared: AnytonePreparedExport,
): Map<string, number> {
  const channelById = new Map(assembled.channels.map((row) => [row.entity.id, row]));
  const expandedRows = orderedDmrExpandedRows(assembled, prepared);
  const slotById = new Map<string, number>();

  expandedRows.forEach((expandedRow, index) => {
    const channelId = expandedRow.sourceChannelId;
    if (slotById.has(channelId)) return;
    const assembledChannel = channelById.get(channelId);
    const slot = assembledChannel?.orderOrSlot ?? index + 1;
    slotById.set(channelId, slot);
  });

  return slotById;
}

/** AMAir.CSV `No.` index by library channel id (programmed rows only; VFO excluded). */
export function resolveAmAirChannelSlotById(assembled: AssembledBuild): Map<string, number> {
  return buildSlotByIdFromOrdered(orderedAmAirChannels(assembled));
}

/** FM.CSV `No.` index by library channel id (programmed rows only; VFO excluded). */
export function resolveFmBroadcastChannelSlotById(assembled: AssembledBuild): Map<string, number> {
  return buildSlotByIdFromOrdered(orderedFmBroadcastChannels(assembled));
}
