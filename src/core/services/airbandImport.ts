import { newZone } from '@core/domain/factories.ts';
import { classifyChannelSetDedup } from '@core/domain/channelSets/dedup.ts';
import type { AirbandAirportInput, AirbandGenerateOptions } from '@core/domain/airband/index.ts';
import { generateChannelsFromAirport } from '@core/domain/airband/index.ts';
import { addChannelsToZoneMembers } from '@core/domain/zoneMembership.ts';
import type { Channel, Library, Zone, ZoneMemberEntry } from '@core/models/library.ts';

export interface AirbandImportOptions extends AirbandGenerateOptions {
  alsoCreateZone?: boolean;
  /** Zone name when alsoCreateZone is true; defaults to "Airband". Ignored when targetZoneId is set. */
  zoneName?: string;
  /**
   * When alsoCreateZone is true, append imported channels to this existing zone instead of creating a new one.
   * Takes precedence over zoneName.
   */
  targetZoneId?: string;
  /**
   * When alsoCreateZone is true, create one zone per airport entry.
   * Default false — one batch zone containing all imported channels.
   * Ignored when targetZoneId is set.
   */
  zonePerAirport?: boolean;
}

export interface AirbandAirportSelection {
  airport: AirbandAirportInput;
  /** Import only these frequency indices; omit to import all civil airband frequencies. */
  frequencyIndices?: number[];
}

export interface SkippedAirbandChannel {
  channel: Channel;
  reason: 'rx_hz' | 'name';
}

export interface AirbandZoneUpdate {
  zoneId: string;
  members: ZoneMemberEntry[];
}

export interface AirbandAirportImportPlan {
  airport: AirbandAirportInput;
  channelsToAdd: Channel[];
  skipped: SkippedAirbandChannel[];
  zone?: Zone;
}

export interface AirbandImportPlan {
  airports: AirbandAirportImportPlan[];
  totalChannelsToAdd: Channel[];
  totalSkipped: SkippedAirbandChannel[];
  zones: Zone[];
  zoneUpdates: AirbandZoneUpdate[];
  /** Set when targetZoneId was requested but the zone was not found in the library. */
  zoneTargetError?: string;
}

const DEFAULT_ZONE_NAME = 'Airband';

function zoneMembersFromChannelIds(channelIds: string[]): ZoneMemberEntry[] {
  return channelIds.map((channelId) => ({ kind: 'channel' as const, channelId }));
}

function resolveZoneName(options: AirbandImportOptions): string {
  return options.zoneName?.trim() || DEFAULT_ZONE_NAME;
}

function resolveExistingChannelId(
  library: Library,
  skipped: SkippedAirbandChannel,
): string | undefined {
  const { channel, reason } = skipped;
  const match = library.channels.find((existing) =>
    reason === 'rx_hz'
      ? existing.rxFrequency === channel.rxFrequency
      : existing.name === channel.name,
  );
  return match?.id;
}

/** Channel ids to add as zone members — new imports plus library matches for skipped duplicates. */
export function channelIdsForZoneMembership(
  library: Library,
  toAdd: Channel[],
  skipped: SkippedAirbandChannel[],
): string[] {
  const ids: string[] = toAdd.map((channel) => channel.id);
  const seen = new Set(ids);
  for (const entry of skipped) {
    const existingId = resolveExistingChannelId(library, entry);
    if (existingId && !seen.has(existingId)) {
      seen.add(existingId);
      ids.push(existingId);
    }
  }
  return ids;
}

function buildSingleAirportPlan(
  library: Library,
  projectId: string,
  selection: AirbandAirportSelection,
  options: AirbandImportOptions,
  createPerAirportZone: boolean,
): AirbandAirportImportPlan {
  const generated = generateChannelsFromAirport(projectId, selection.airport, {
    ...options,
    frequencyIndices: selection.frequencyIndices ?? options.frequencyIndices,
  });
  const dedup = classifyChannelSetDedup(library.channels, generated);

  const skipped: SkippedAirbandChannel[] = [
    ...dedup.skippedByRxHz.map((channel) => ({ channel, reason: 'rx_hz' as const })),
    ...dedup.skippedByName.map((channel) => ({ channel, reason: 'name' as const })),
  ];

  let zone: Zone | undefined;
  if (
    options.alsoCreateZone &&
    !options.targetZoneId &&
    createPerAirportZone &&
    dedup.toAdd.length > 0
  ) {
    zone = {
      ...newZone(projectId, resolveZoneName(options)),
      members: zoneMembersFromChannelIds(dedup.toAdd.map((ch) => ch.id)),
    };
  }

  return {
    airport: selection.airport,
    channelsToAdd: dedup.toAdd,
    skipped,
    zone,
  };
}

/**
 * Pure plan for importing airport airband frequencies into a library.
 */
export function buildAirbandImportPlan(
  library: Library,
  projectId: string,
  selections: readonly AirbandAirportSelection[],
  options: AirbandImportOptions = {},
): AirbandImportPlan {
  const zonePerAirport = options.zonePerAirport ?? false;
  const appendToExisting = Boolean(options.alsoCreateZone && options.targetZoneId);

  const airportPlans = selections.map((selection) =>
    buildSingleAirportPlan(
      library,
      projectId,
      selection,
      options,
      zonePerAirport && !appendToExisting,
    ),
  );

  const totalChannelsToAdd = airportPlans.flatMap((plan) => plan.channelsToAdd);
  const totalSkipped = airportPlans.flatMap((plan) => plan.skipped);

  let zones: Zone[] = [];
  let zoneUpdates: AirbandZoneUpdate[] = [];
  let zoneTargetError: string | undefined;

  if (options.alsoCreateZone && appendToExisting) {
    const targetZone = library.zones.find((zone) => zone.id === options.targetZoneId);
    if (!targetZone) {
      zoneTargetError = 'Selected zone was not found in the library.';
    } else {
      const channelIds = channelIdsForZoneMembership(library, totalChannelsToAdd, totalSkipped);
      if (channelIds.length > 0) {
        zoneUpdates = [
          {
            zoneId: targetZone.id,
            members: addChannelsToZoneMembers(targetZone.members, channelIds),
          },
        ];
      }
    }
  } else if (options.alsoCreateZone && !zonePerAirport && totalChannelsToAdd.length > 0) {
    zones = [
      {
        ...newZone(projectId, resolveZoneName(options)),
        members: zoneMembersFromChannelIds(totalChannelsToAdd.map((ch) => ch.id)),
      },
    ];
  } else if (options.alsoCreateZone && !appendToExisting) {
    zones = airportPlans.flatMap((plan) => (plan.zone ? [plan.zone] : []));
  }

  return {
    airports: airportPlans,
    totalChannelsToAdd,
    totalSkipped,
    zones,
    zoneUpdates,
    zoneTargetError,
  };
}
