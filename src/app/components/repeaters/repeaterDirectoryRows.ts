import type { Channel } from '@core/models/library.ts';
import type { RepeaterListing } from '@integrations/repeaters/index.ts';
import { findChannelByCallsign } from './findChannelByCallsign.ts';

export interface RepeaterDirectoryRow {
  listing: RepeaterListing;
  key: string;
  /** Existing library channel with matching callsign (case-insensitive). */
  existing: Channel | null;
}

/**
 * Build result rows for repeater directory search.
 * Duplicate import gating uses callsign only — channel `name` is a display label, not an FK.
 */
export function buildRepeaterDirectoryRows(
  listings: RepeaterListing[],
  channels: Channel[],
  keyFn: (listing: RepeaterListing) => string,
): RepeaterDirectoryRow[] {
  return listings.map((listing) => ({
    listing,
    key: keyFn(listing),
    existing: findChannelByCallsign(channels, listing.callsign),
  }));
}
