import type { Channel } from '@core/models/library.ts';
import type { ChannelBehaviourContext } from '@core/import-export/channelBehaviourDefaults/index.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import {
  classifyAnytoneExportChannelBank as classifyFromFormat,
  partitionAnytoneChannels as partitionChannelsFromFormat,
  type AnytoneChannelPartition,
  type AnytoneExportChannelBank,
} from '@core/import-export/formats/anytone/receiveOnlyBanks.ts';
import {
  partitionAnytoneZones as partitionZonesFromFormat,
  type AnytoneZonePartition,
} from '@core/import-export/formats/anytone/zonePartition.ts';

export type { AnytoneExportChannelBank, AnytoneChannelPartition, AnytoneZonePartition };

/** Anytone CPS export bank for a library channel (DMR/main, AM air, FM broadcast). */
export function classifyAnytoneExportChannelBank(channel: Channel): AnytoneExportChannelBank {
  return classifyFromFormat(channel);
}

/** Split assembled channels into DMR, AM airband, and FM broadcast banks (Anytone CSV parity). */
export function partitionAnytoneChannels(
  assembled: AssembledBuild,
  context?: ChannelBehaviourContext,
): AnytoneChannelPartition {
  return partitionChannelsFromFormat(assembled, context);
}

/** Split build zones into DMR-bank and AM airband-bank member lists. */
export function partitionAnytoneZones(
  assembled: AssembledBuild,
  context?: ChannelBehaviourContext,
): AnytoneZonePartition {
  return partitionZonesFromFormat(assembled, context);
}
