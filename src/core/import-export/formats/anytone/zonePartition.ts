import type { ChannelBehaviourContext } from '@core/import-export/channelBehaviourDefaults/index.ts';
import type { Channel } from '@core/models/library.ts';
import type { AssembledBuild, AssembledZone } from '@core/services/assemble.ts';
import { isAmAirbandBankChannel } from './receiveOnlyBanks.ts';

export type AnytoneZoneBankKind = 'dmr' | 'airband' | 'dual';

export interface PartitionedZoneRow {
  zoneId: string;
  memberChannelIds: string[];
}

export interface AnytoneZonePartition {
  dmrZones: PartitionedZoneRow[];
  amZones: PartitionedZoneRow[];
}

function partitionZoneMembers(
  zone: AssembledZone,
  channelById: Map<string, { id: string } & Parameters<typeof isAmAirbandBankChannel>[0]>,
  context?: ChannelBehaviourContext,
): { dmrMembers: string[]; amMembers: string[] } {
  const dmrMembers: string[] = [];
  const amMembers: string[] = [];

  for (const channelId of zone.memberChannelIds) {
    const channel = channelById.get(channelId);
    if (!channel) continue;
    if (isAmAirbandBankChannel(channel, context)) {
      amMembers.push(channelId);
    } else {
      dmrMembers.push(channelId);
    }
  }

  return { dmrMembers, amMembers };
}

export function classifyAnytoneZoneByMembers(
  memberChannelIds: string[],
  channelById: Map<string, Channel>,
  context?: ChannelBehaviourContext,
): AnytoneZoneBankKind {
  let hasAirband = false;
  let hasDmr = false;

  for (const channelId of memberChannelIds) {
    const channel = channelById.get(channelId);
    if (!channel) continue;
    if (isAmAirbandBankChannel(channel, context)) {
      hasAirband = true;
    } else {
      hasDmr = true;
    }
  }

  if (hasAirband && hasDmr) return 'dual';
  if (hasAirband) return 'airband';
  return 'dmr';
}

export function zoneShowsOnAnytoneDmrBank(kind: AnytoneZoneBankKind): boolean {
  return kind === 'dmr' || kind === 'dual';
}

export function zoneShowsOnAnytoneAirbandBank(kind: AnytoneZoneBankKind): boolean {
  return kind === 'airband' || kind === 'dual';
}

/** Split build zones into DMR-bank and AM airband-bank projections for Anytone export. */
export function partitionAnytoneZones(
  assembled: AssembledBuild,
  context?: ChannelBehaviourContext,
): AnytoneZonePartition {
  const channelById = new Map(assembled.channels.map((row) => [row.entity.id, row.entity]));
  const dmrZones: PartitionedZoneRow[] = [];
  const amZones: PartitionedZoneRow[] = [];

  for (const zone of assembled.zones) {
    const { dmrMembers, amMembers } = partitionZoneMembers(zone, channelById, context);
    if (dmrMembers.length > 0) {
      dmrZones.push({ zoneId: zone.zoneId, memberChannelIds: dmrMembers });
    }
    if (amMembers.length > 0) {
      amZones.push({ zoneId: zone.zoneId, memberChannelIds: amMembers });
    }
  }

  return { dmrZones, amZones };
}

export function hasAmZoneExport(
  assembled: AssembledBuild,
  context?: ChannelBehaviourContext,
): boolean {
  return partitionAnytoneZones(assembled, context).amZones.length > 0;
}
