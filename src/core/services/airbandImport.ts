import { newZone } from '@core/domain/factories.ts';
import { classifyChannelSetDedup } from '@core/domain/channelSets/dedup.ts';
import type { AirbandAirportInput, AirbandGenerateOptions } from '@core/domain/airband/index.ts';
import { generateChannelsFromAirport } from '@core/domain/airband/index.ts';
import type { Channel, Library, Zone, ZoneMemberEntry } from '@core/models/library.ts';

export interface AirbandImportOptions extends AirbandGenerateOptions {
  alsoCreateZone?: boolean;
  /** Zone name when alsoCreateZone is true; defaults to airport label. */
  zoneName?: string;
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

function zoneMembersFromChannelIds(channelIds: string[]): ZoneMemberEntry[] {
  return channelIds.map((channelId) => ({ kind: 'channel' as const, channelId }));
}

function defaultZoneName(airport: AirbandAirportInput): string {
  const code = airport.icao ?? airport.iata;
  if (code && airport.name) return `${code} — ${airport.name}`;
  return airport.name || code || 'Airband';
}

function buildSingleAirportPlan(
  library: Library,
  projectId: string,
  airport: AirbandAirportInput,
  options: AirbandImportOptions,
): AirbandAirportImportPlan {
  const generated = generateChannelsFromAirport(projectId, airport, options);
  const dedup = classifyChannelSetDedup(library.channels, generated);

  const skipped: SkippedAirbandChannel[] = [
    ...dedup.skippedByRxHz.map((channel) => ({ channel, reason: 'rx_hz' as const })),
    ...dedup.skippedByName.map((channel) => ({ channel, reason: 'name' as const })),
  ];

  let zone: Zone | undefined;
  if (options.alsoCreateZone && dedup.toAdd.length > 0) {
    const zoneName = options.zoneName?.trim() || defaultZoneName(airport);
    zone = {
      ...newZone(projectId, zoneName),
      members: zoneMembersFromChannelIds(dedup.toAdd.map((ch) => ch.id)),
    };
  }

  return {
    airport,
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
  airports: AirbandAirportInput[],
  options: AirbandImportOptions = {},
): AirbandImportPlan {
  const airportPlans = airports.map((airport) =>
    buildSingleAirportPlan(library, projectId, airport, options),
  );

  const totalChannelsToAdd = airportPlans.flatMap((plan) => plan.channelsToAdd);
  const totalSkipped = airportPlans.flatMap((plan) => plan.skipped);
  const zones = airportPlans.flatMap((plan) => (plan.zone ? [plan.zone] : []));

  return {
    airports: airportPlans,
    totalChannelsToAdd,
    totalSkipped,
    zones,
  };
}
