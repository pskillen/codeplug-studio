import { newZone } from '@core/domain/factories.ts';
import {
  channelSetDefinition,
  classifyChannelSetDedup,
  generateChannelsFromSet,
} from '@core/domain/channelSets/index.ts';
import type { ChannelSetGenerateOptions, ChannelSetId } from '@core/domain/channelSets/types.ts';
import type { Channel, Library, Zone, ZoneMemberEntry } from '@core/models/library.ts';

export interface ChannelSetImportOptions extends ChannelSetGenerateOptions {
  alsoCreateZone?: boolean;
  /** Zone name when alsoCreateZone is true; defaults to set label. */
  zoneName?: string;
  /** Template indices to include; omit for all channels in the set. */
  includedIndices?: number[];
}

export interface SkippedChannel {
  channel: Channel;
  reason: 'rx_hz' | 'name';
}

export interface ChannelSetImportPlan {
  setId: ChannelSetId;
  channelsToAdd: Channel[];
  skipped: SkippedChannel[];
  zone?: Zone;
}

function zoneMembersFromChannelIds(channelIds: string[]): ZoneMemberEntry[] {
  return channelIds.map((channelId) => ({ kind: 'channel' as const, channelId }));
}

/**
 * Pure plan for importing a channel set into a library — no persistence I/O.
 */
export function buildChannelSetImportPlan(
  library: Library,
  projectId: string,
  setId: ChannelSetId,
  options: ChannelSetImportOptions = {},
): ChannelSetImportPlan {
  const generated = generateChannelsFromSet(projectId, setId, options);
  const included = options.includedIndices
    ? generated.filter((_, index) => options.includedIndices!.includes(index))
    : generated;
  const dedup = classifyChannelSetDedup(library.channels, included);

  const skipped: SkippedChannel[] = [
    ...dedup.skippedByRxHz.map((channel) => ({ channel, reason: 'rx_hz' as const })),
    ...dedup.skippedByName.map((channel) => ({ channel, reason: 'name' as const })),
  ];

  let zone: Zone | undefined;
  if (options.alsoCreateZone && dedup.toAdd.length > 0) {
    const def = channelSetDefinition(setId);
    const zoneName = options.zoneName?.trim() || def.label;
    zone = {
      ...newZone(projectId, zoneName),
      members: zoneMembersFromChannelIds(dedup.toAdd.map((ch) => ch.id)),
    };
  }

  return {
    setId,
    channelsToAdd: dedup.toAdd,
    skipped,
    zone,
  };
}
