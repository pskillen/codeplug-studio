import type { Channel, Zone } from '../models/library.ts';
import { convexHullLatLon, pointInConvexHull, type LatLon, uniqueLatLon } from './geo.ts';
import { haversineDistanceM } from './geoDistance.ts';
import {
  applyFilters,
  buildChannelById,
  channelHasGeolocation,
  DEFAULT_MAP_FILTER_OPTS,
  zoneGeolocatedPoints,
} from './mapProjection.ts';

/** Matches single-site zone hull circle on the map (`CodeplugMap`). */
export const ZONE_HULL_SINGLE_SITE_RADIUS_M = 2500;

export interface GeoCentre {
  lat: number;
  lon: number;
}

export interface GrowSuggestionResult {
  /** Suggested channel ids in display order. */
  channelIds: string[];
  distancesM: Map<string, number>;
}

/** Arithmetic mean of unique geolocated points. */
export function zoneCentreFromPoints(points: LatLon[]): GeoCentre | null {
  if (points.length === 0) return null;
  let latSum = 0;
  let lonSum = 0;
  for (const [lat, lon] of points) {
    latSum += lat;
    lonSum += lon;
  }
  return { lat: latSum / points.length, lon: lonSum / points.length };
}

/**
 * Whether a channel coordinate lies inside the zone hull geometry used on the map:
 * 1 site → 2.5 km circle; 2 sites → no area; 3+ → convex hull polygon.
 */
export function pointInZoneHull(point: LatLon, memberPoints: LatLon[]): boolean {
  const points = uniqueLatLon(memberPoints);
  if (points.length === 0) return false;
  if (points.length === 1) {
    const [cLat, cLon] = points[0];
    const [lat, lon] = point;
    return haversineDistanceM(lat, lon, cLat, cLon) <= ZONE_HULL_SINGLE_SITE_RADIUS_M;
  }
  if (points.length === 2) return false;
  const hull = convexHullLatLon(points);
  return pointInConvexHull(point, hull);
}

export function resolveZoneMemberGeolocatedPoints(
  zone: Zone,
  allZones: Zone[],
  channels: Channel[],
): LatLon[] {
  const plotted = applyFilters(channels, DEFAULT_MAP_FILTER_OPTS).plotted;
  const plottedById = buildChannelById(plotted);
  return zoneGeolocatedPoints(zone, allZones, plottedById, channels, DEFAULT_MAP_FILTER_OPTS)
    .points;
}

export function suggestChannelsInsideHull(
  channels: Channel[],
  excludeIds: ReadonlySet<string>,
  memberPoints: LatLon[],
): GrowSuggestionResult {
  const distancesM = new Map<string, number>();
  const matches: Channel[] = [];

  for (const channel of channels) {
    if (excludeIds.has(channel.id)) continue;
    if (!channelHasGeolocation(channel)) continue;
    const point: LatLon = [channel.location!.lat, channel.location!.lon];
    if (!pointInZoneHull(point, memberPoints)) continue;
    matches.push(channel);
  }

  matches.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const channelIds = matches.map((ch) => ch.id);
  return { channelIds, distancesM };
}

export function rankChannelsByDistance(
  channels: Channel[],
  excludeIds: ReadonlySet<string>,
  centre: GeoCentre,
): GrowSuggestionResult {
  const matches: { channel: Channel; distanceM: number }[] = [];

  for (const channel of channels) {
    if (excludeIds.has(channel.id)) continue;
    if (!channelHasGeolocation(channel)) continue;
    const distanceM = haversineDistanceM(
      centre.lat,
      centre.lon,
      channel.location!.lat,
      channel.location!.lon,
    );
    matches.push({ channel, distanceM });
  }

  matches.sort((a, b) => {
    const byDistance = a.distanceM - b.distanceM;
    if (byDistance !== 0) return byDistance;
    return a.channel.name.localeCompare(b.channel.name, undefined, { sensitivity: 'base' });
  });

  const distancesM = new Map<string, number>();
  const channelIds: string[] = [];
  for (const { channel, distanceM } of matches) {
    channelIds.push(channel.id);
    distancesM.set(channel.id, distanceM);
  }

  return { channelIds, distancesM };
}
