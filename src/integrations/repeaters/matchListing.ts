import type { Channel } from '@core/models/library.ts';
import type { RepeaterListing } from './types.ts';

/** Pick the best directory listing for an existing channel. */
export function matchListingForChannel(
  channel: Channel,
  listings: RepeaterListing[],
): RepeaterListing | null {
  if (listings.length === 0) return null;

  if (channel.rxFrequency != null && channel.txFrequency != null) {
    const byFreq = listings.find(
      (l) =>
        l.rxFrequencyHz === channel.rxFrequency && l.txFrequencyHz === channel.txFrequency,
    );
    if (byFreq) return byFreq;
  }

  if (channel.callsign.trim()) {
    const upper = channel.callsign.toUpperCase();
    const byCall = listings.find((l) => l.callsign.toUpperCase() === upper);
    if (byCall) return byCall;
  }

  return listings.length === 1 ? listings[0]! : null;
}
