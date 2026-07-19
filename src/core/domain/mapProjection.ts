import type { Channel, ChannelMode, Zone } from '../models/library.ts';
import { resolveChannelPrimaryMode } from './modeProfiles.ts';
import { resolveEffectiveZoneChannelIds } from './zoneHierarchy.ts';
import type { LatLon } from './geo.ts';
import { uniqueLatLon } from './geo.ts';

export interface FilterOptions {
  requireUseLocation: boolean;
  skipZero: boolean;
}

export interface SkippedChannel {
  name: string;
  reason: string;
}

export interface ZoneMemberMissing {
  name: string;
  reason: string;
}

export const DEFAULT_MAP_FILTER_OPTS: FilterOptions = {
  requireUseLocation: true,
  skipZero: true,
};

/** Skip reason when a channel must not appear on the internal map, or null when plottable. */
export function channelMapSkipReason(
  ch: Channel,
  { requireUseLocation, skipZero }: FilterOptions,
): string | null {
  if (ch.location == null) return 'missing coordinates';
  if (skipZero && ch.location.lat === 0 && ch.location.lon === 0) return '0,0 coordinates';
  if (requireUseLocation && !ch.useLocation) return 'Use Location = No';
  if (ch.hideFromInternalMap) return 'hidden from map';
  return null;
}

export function channelPlottableOnMap(ch: Channel, opts: FilterOptions): boolean {
  return channelMapSkipReason(ch, opts) === null;
}

/** Primary RF mode for map colouring — `primaryMode` when set, else first profile. */
export function primaryMode(channel: Channel): ChannelMode | null {
  return resolveChannelPrimaryMode(channel);
}

/** All RF modes represented on a channel. */
export function channelModes(channel: Channel): ChannelMode[] {
  return channel.modeProfiles.map((p) => p.mode);
}

export function channelDisplayLabel(
  channel: Pick<Channel, 'callsign' | 'name'>,
  useFull: boolean,
): string {
  if (!useFull) return channel.callsign.trim() || channel.name.trim();
  const callsign = channel.callsign.trim();
  const name = channel.name.trim();
  if (callsign && name) return `${callsign} — ${name}`;
  return callsign || name;
}

/** Base channel marker diameter (px) before stack scaling. */
export const MARKER_DOT_BASE_PX = 18;
/** Extra diameter (px) per co-located channel beyond the first. */
export const MARKER_DOT_STACK_INCREMENT_PX = 4;
export const MARKER_DOT_MAX_PX = 34;

export function markerDotSizePx(stackCount: number): number {
  const count = Math.max(1, Math.floor(stackCount));
  return Math.min(
    MARKER_DOT_MAX_PX,
    MARKER_DOT_BASE_PX + (count - 1) * MARKER_DOT_STACK_INCREMENT_PX,
  );
}

export function markerLabel(group: Channel[], useFull: boolean): string {
  const ch = group[0];
  if (group.length === 1 && channelModes(ch).length > 1) {
    const base = channelDisplayLabel(ch, useFull);
    return `${base} (${channelModes(ch).join('+')})`;
  }
  if (group.length > 1) {
    const base = channelDisplayLabel(ch, useFull);
    return `${base} +${group.length - 1}`;
  }
  return channelDisplayLabel(ch, useFull);
}

export function dominantMode(group: Channel[]): ChannelMode | null {
  const counts = new Map<ChannelMode, number>();
  for (const ch of group) {
    const mode = primaryMode(ch);
    if (mode == null) continue;
    counts.set(mode, (counts.get(mode) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  let best: ChannelMode | null = null;
  let bestCount = 0;
  for (const [mode, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = mode;
    }
  }
  return best;
}

/**
 * Whether a co-located marker stack should render dimmed.
 * Dim only when every channel in the group is dimmed — mixed in/out stacks stay full opacity.
 */
export function groupIsDimmed(group: Channel[], dimmedIds: ReadonlySet<string>): boolean {
  return group.length > 0 && group.every((c) => dimmedIds.has(c.id));
}

export function applyFilters(
  channels: Channel[],
  { requireUseLocation, skipZero }: FilterOptions,
): { plotted: Channel[]; skipped: SkippedChannel[] } {
  const plotted: Channel[] = [];
  const skipped: SkippedChannel[] = [];

  for (const ch of channels) {
    const reason = channelMapSkipReason(ch, { requireUseLocation, skipZero });
    if (reason) {
      skipped.push({ name: ch.name, reason });
      continue;
    }
    plotted.push(ch);
  }
  return { plotted, skipped };
}

export function groupByCoords(list: Channel[], merge: boolean): Channel[][] {
  if (!merge) return list.map((ch) => [ch]);
  const map = new Map<string, Channel[]>();
  for (const ch of list) {
    const key = `${ch.location!.lat.toFixed(5)},${ch.location!.lon.toFixed(5)}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ch);
  }
  return [...map.values()];
}

export function buildChannelById(plotted: Channel[]): Map<string, Channel> {
  const index = new Map<string, Channel>();
  for (const ch of plotted) {
    index.set(ch.id, ch);
  }
  return index;
}

export function zoneGeolocatedPoints(
  zone: Zone,
  allZones: Zone[],
  plottedById: Map<string, Channel>,
  allChannels: Channel[],
  { skipZero, requireUseLocation }: FilterOptions,
): { points: LatLon[]; missing: ZoneMemberMissing[] } {
  const points: LatLon[] = [];
  const missing: ZoneMemberMissing[] = [];
  const seenIds = new Set<string>();

  const channelMembers = resolveEffectiveZoneChannelIds(zone, allZones);

  for (const memberId of channelMembers) {
    if (seenIds.has(memberId)) continue;
    seenIds.add(memberId);

    const ch = plottedById.get(memberId) ?? allChannels.find((c) => c.id === memberId);
    if (!ch) {
      missing.push({ name: memberId, reason: 'unresolved member' });
      continue;
    }

    if (!plottedById.has(memberId)) {
      missing.push({
        name: ch.name,
        reason: ch.hideFromInternalMap ? 'hidden from map' : 'filtered out or missing coordinates',
      });
      continue;
    }

    if (ch.location == null) {
      missing.push({ name: ch.name, reason: 'no coordinates' });
      continue;
    }
    if (skipZero && ch.location.lat === 0 && ch.location.lon === 0) {
      missing.push({ name: ch.name, reason: '0,0 coordinates' });
      continue;
    }
    if (requireUseLocation && !ch.useLocation) {
      missing.push({ name: ch.name, reason: 'Use Location = No' });
      continue;
    }
    points.push([ch.location.lat, ch.location.lon]);
  }

  return { points: uniqueLatLon(points), missing };
}

export function channelHasGeolocation(channel: Channel): boolean {
  const { location, useLocation } = channel;
  return (
    useLocation &&
    location != null &&
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lon)
  );
}
