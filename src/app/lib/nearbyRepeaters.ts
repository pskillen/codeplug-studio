import { bandFromFrequencyMhz } from '@core/domain/bandCatalog.ts';
import { channelHasGeolocation, channelModes } from '@core/domain/mapProjection.ts';
import type { GeoPoint } from '@core/models/libraryTypes.ts';
import type { Channel } from '@core/models/library.ts';
import type { ChannelMode } from '@core/models/libraryTypes.ts';
import type { RepeaterListing } from '@integrations/repeaters/index.ts';
import { findChannelByCallsign } from '../components/repeaters/findChannelByCallsign.ts';
import { isOperationalStatus } from './repeaters.ts';

export type NearbySource = 'ukrepeater' | 'library';

export const NEARBY_SOURCES: readonly NearbySource[] = ['ukrepeater', 'library'];

/** One row in the Nearby repeaters list, from a directory listing or a library channel. */
export interface NearbyItem {
  key: string;
  source: NearbySource;
  callsign: string;
  name: string;
  rxFrequencyHz: number | null;
  /** Band id from the shared band catalogue ("2m", "70cm"), or "" when unknown. */
  band: string;
  modes: ChannelMode[];
  status: string;
  location: GeoPoint;
  /** Directory listing, present for directory rows (what "+ Add" imports). */
  listing?: RepeaterListing;
  /** True when the open project's library already has this callsign. */
  inLibrary: boolean;
}

export interface NearbyFilters {
  /** Band ids to keep; empty keeps all. */
  bands: readonly string[];
  /** Modes to keep; empty keeps all. */
  modes: readonly ChannelMode[];
  operationalOnly: boolean;
}

function bandOf(rxHz: number | null, fallback = ''): string {
  if (rxHz != null) {
    const band = bandFromFrequencyMhz(rxHz / 1_000_000);
    if (band) return band.id;
  }
  return fallback.toLowerCase();
}

/**
 * Merge directory listings and library channels into rows. A library channel whose callsign is also
 * in the directory results is folded into the directory row (shown as "In library"), so a repeater
 * never appears twice.
 */
export function buildNearbyItems(input: {
  listings: readonly RepeaterListing[];
  channels: readonly Channel[];
  sources: readonly NearbySource[];
}): NearbyItem[] {
  const { listings, channels, sources } = input;
  const items: NearbyItem[] = [];
  const directoryCallsigns = new Set<string>();

  if (sources.includes('ukrepeater')) {
    for (const listing of listings) {
      if (!listing.location) continue;
      directoryCallsigns.add(listing.callsign.trim().toUpperCase());
      items.push({
        key: `${listing.source}:${listing.remoteId}`,
        source: 'ukrepeater',
        callsign: listing.callsign,
        name: listing.name,
        rxFrequencyHz: listing.rxFrequencyHz,
        band: bandOf(listing.rxFrequencyHz, listing.band),
        modes: listing.modes,
        status: listing.status,
        location: listing.location,
        listing,
        inLibrary: findChannelByCallsign(channels as Channel[], listing.callsign) != null,
      });
    }
  }

  if (sources.includes('library')) {
    for (const ch of channels) {
      if (!channelHasGeolocation(ch)) continue;
      const callsign = ch.callsign.trim() || ch.name;
      if (directoryCallsigns.has(callsign.toUpperCase())) continue;
      items.push({
        key: `library:${ch.id}`,
        source: 'library',
        callsign,
        name: ch.name === callsign ? '' : ch.name,
        rxFrequencyHz: ch.rxFrequency,
        band: bandOf(ch.rxFrequency),
        modes: channelModes(ch),
        status: '',
        location: ch.location as GeoPoint,
        inLibrary: true,
      });
    }
  }
  return items;
}

export function applyNearbyFilters(items: readonly NearbyItem[], f: NearbyFilters): NearbyItem[] {
  return items.filter((item) => {
    if (f.bands.length > 0 && !f.bands.includes(item.band)) return false;
    if (f.modes.length > 0 && !item.modes.some((m) => f.modes.includes(m))) return false;
    if (f.operationalOnly && item.status && !isOperationalStatus(item.status)) return false;
    return true;
  });
}
