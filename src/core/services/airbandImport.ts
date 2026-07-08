import { newZone } from '@core/domain/factories.ts';
import { classifyChannelSetDedup } from '@core/domain/channelSets/dedup.ts';
import type { AirbandAirportInput, AirbandGenerateOptions } from '@core/domain/airband/index.ts';
import { generateChannelsFromAirport } from '@core/domain/airband/index.ts';
import type { Channel, Library, Zone, ZoneMemberEntry } from '@core/models/library.ts';

export interface AirbandImportOptions extends AirbandGenerateOptions {
  alsoCreateZone?: boolean;
  /** Zone name when alsoCreateZone is true; defaults to "Airband". */
  zoneName?: string;
  /**
   * When alsoCreateZone is true, create one zone per airport entry.
   * Default false — one batch zone containing all imported channels.
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
}

const DEFAULT_ZONE_NAME = 'Airband';

function zoneMembersFromChannelIds(channelIds: string[]): ZoneMemberEntry[] {
  return channelIds.map((channelId) => ({ kind: 'channel' as const, channelId }));
}

function resolveZoneName(options: AirbandImportOptions): string {
  return options.zoneName?.trim() || DEFAULT_ZONE_NAME;
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
  if (options.alsoCreateZone && createPerAirportZone && dedup.toAdd.length > 0) {
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
  const airportPlans = selections.map((selection) =>
    buildSingleAirportPlan(library, projectId, selection, options, zonePerAirport),
  );

  const totalChannelsToAdd = airportPlans.flatMap((plan) => plan.channelsToAdd);
  const totalSkipped = airportPlans.flatMap((plan) => plan.skipped);

  let zones: Zone[];
  if (options.alsoCreateZone && !zonePerAirport && totalChannelsToAdd.length > 0) {
    zones = [
      {
        ...newZone(projectId, resolveZoneName(options)),
        members: zoneMembersFromChannelIds(totalChannelsToAdd.map((ch) => ch.id)),
      },
    ];
  } else {
    zones = airportPlans.flatMap((plan) => (plan.zone ? [plan.zone] : []));
  }

  return {
    airports: airportPlans,
    totalChannelsToAdd,
    totalSkipped,
    zones,
  };
}
