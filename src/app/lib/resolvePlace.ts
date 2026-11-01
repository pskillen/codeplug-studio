import { coordsToLocator, isValidLocator, locatorToCoords } from '@core/domain/maidenhead.ts';
import type { Channel } from '@core/models/library.ts';
import { geocodeQuery, type GeocodeProvider } from '@integrations/geocode/index.ts';
import { channelHasLocation, channelOptionLabel } from './channelLookup.ts';

export type PlaceKind = 'locator' | 'channel' | 'address' | 'gps' | 'map';

/** A resolved point for the Field tools. */
export interface Place {
  lat: number;
  lon: number;
  /** Human label: place name, channel name or "My location". */
  label: string;
  kind: PlaceKind;
}

export interface ResolvePlaceOptions {
  /** Open project's channels (empty when no project is open). */
  channels?: readonly Channel[];
  mapboxToken?: string;
  provider?: GeocodeProvider;
}

export class PlaceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlaceNotFoundError';
  }
}

/** Library channels matching a callsign or name exactly (case-insensitive), with a usable location. */
export function findLocatedChannels(channels: readonly Channel[], text: string): Channel[] {
  const q = text.trim().toLowerCase();
  if (!q) return [];
  const located = channels.filter(channelHasLocation);
  const exact = located.filter(
    (ch) => ch.callsign?.toLowerCase() === q || ch.name.toLowerCase() === q,
  );
  if (exact.length > 0) return exact;
  return located.filter((ch) => channelOptionLabel(ch).toLowerCase() === q);
}

export function placeFromChannel(ch: Channel): Place {
  return {
    lat: ch.location!.lat,
    lon: ch.location!.lon,
    label: channelOptionLabel(ch),
    kind: 'channel',
  };
}

export function placeFromCoords(
  lat: number,
  lon: number,
  kind: PlaceKind = 'map',
  label?: string,
): Place {
  return { lat, lon, kind, label: label ?? coordsToLocator(lat, lon, 6) };
}

/**
 * Turn what someone typed into a point: a Maidenhead locator, a library channel (callsign or name,
 * only when a project supplies channels) or, failing both, an address / postcode via geocoding.
 */
export async function resolvePlace(text: string, opts: ResolvePlaceOptions = {}): Promise<Place> {
  const trimmed = text.trim();
  if (!trimmed) throw new PlaceNotFoundError('Enter a locator, callsign or address');

  if (isValidLocator(trimmed)) {
    const c = locatorToCoords(trimmed)!;
    return {
      lat: c.lat,
      lon: c.lon,
      label: trimmed.toUpperCase().replace(/\s/g, ''),
      kind: 'locator',
    };
  }

  const matches = findLocatedChannels(opts.channels ?? [], trimmed);
  if (matches.length > 0) return placeFromChannel(matches[0]);

  const geo = await geocodeQuery(trimmed, {
    mapboxToken: opts.mapboxToken,
    provider: opts.provider,
  });
  if (!geo) throw new PlaceNotFoundError('No results found');
  return { lat: geo.lat, lon: geo.lon, label: geo.label, kind: 'address' };
}
