import { newZone } from '@core/domain/factories.ts';
import {
  classifyPublicServiceDedup,
  generateChannelsFromGroups,
} from '@core/domain/publicServices/index.ts';
import type {
  PublicServiceCountry,
  PublicServiceDedupAdvisory,
} from '@core/domain/publicServices/index.ts';
import type { Channel, Library, Zone, ZoneMemberEntry } from '@core/models/library.ts';

export interface PublicServiceImportOptions {
  /** Off by default. When true, create one library zone per selected group that adds channels. */
  alsoCreateZones?: boolean;
}

export interface SkippedPublicServiceChannel {
  channel: Channel;
  reason: 'name';
}

export interface PublicServiceImportPlan {
  countryCode: string;
  groupIds: readonly string[];
  channelsToAdd: Channel[];
  skipped: SkippedPublicServiceChannel[];
  advisories: PublicServiceDedupAdvisory[];
  zones: Zone[];
}

function zoneMembersFromChannelIds(channelIds: string[]): ZoneMemberEntry[] {
  return channelIds.map((channelId) => ({ kind: 'channel' as const, channelId }));
}

function normaliseName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Pure plan for importing public-service channel groups into a library.
 */
export function buildPublicServiceImportPlan(
  library: Library,
  projectId: string,
  country: PublicServiceCountry,
  groupIds: readonly string[],
  options: PublicServiceImportOptions = {},
): PublicServiceImportPlan {
  const generated = generateChannelsFromGroups(projectId, country, groupIds);
  const dedup = classifyPublicServiceDedup(library.channels, generated);

  const skipped: SkippedPublicServiceChannel[] = dedup.skippedByName.map((channel) => ({
    channel,
    reason: 'name',
  }));

  const zones: Zone[] = [];
  if (options.alsoCreateZones) {
    const addableByName = new Map(
      dedup.toAdd.map((channel) => [normaliseName(channel.name), channel] as const),
    );
    const selected = new Set(groupIds);
    for (const group of country.groups) {
      if (!selected.has(group.groupId)) continue;
      const memberIds = group.entries
        .map((entry) => addableByName.get(normaliseName(entry.name))?.id)
        .filter((id): id is string => id != null);
      if (memberIds.length === 0) continue;
      zones.push({
        ...newZone(projectId, group.label),
        members: zoneMembersFromChannelIds(memberIds),
      });
    }
  }

  return {
    countryCode: country.countryCode,
    groupIds,
    channelsToAdd: dedup.toAdd,
    skipped,
    advisories: dedup.advisories,
    zones,
  };
}
