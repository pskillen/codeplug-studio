import type { AssembledBuild, AssembledZone } from '@core/services/assemble.ts';
import { isAmAirbandBankChannel } from './receiveOnlyBanks.ts';

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
): { dmrMembers: string[]; amMembers: string[] } {
  const dmrMembers: string[] = [];
  const amMembers: string[] = [];

  for (const channelId of zone.memberChannelIds) {
    const channel = channelById.get(channelId);
    if (!channel) continue;
    if (isAmAirbandBankChannel(channel)) {
      amMembers.push(channelId);
    } else {
      dmrMembers.push(channelId);
    }
  }

  return { dmrMembers, amMembers };
}

/** Split build zones into DMR-bank and AM airband-bank projections for Anytone export. */
export function partitionAnytoneZones(assembled: AssembledBuild): AnytoneZonePartition {
  const channelById = new Map(assembled.channels.map((row) => [row.entity.id, row.entity]));
  const dmrZones: PartitionedZoneRow[] = [];
  const amZones: PartitionedZoneRow[] = [];

  for (const zone of assembled.zones) {
    const { dmrMembers, amMembers } = partitionZoneMembers(zone, channelById);
    if (dmrMembers.length > 0) {
      dmrZones.push({ zoneId: zone.zoneId, memberChannelIds: dmrMembers });
    }
    if (amMembers.length > 0) {
      amZones.push({ zoneId: zone.zoneId, memberChannelIds: amMembers });
    }
  }

  return { dmrZones, amZones };
}

export function hasAmZoneExport(assembled: AssembledBuild): boolean {
  return partitionAnytoneZones(assembled).amZones.length > 0;
}
