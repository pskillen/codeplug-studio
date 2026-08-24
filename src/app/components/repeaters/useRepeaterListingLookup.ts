import { useState } from 'react';
import type { Channel } from '@core/models/library.ts';
import {
  matchListingForChannel,
  RepeaterDirectoryError,
  searchBrandmeisterByCallsign,
  searchIrtsByCallsign,
  searchRepeaterBookByCallsignAnyRegion,
  searchUkRepeatersByCallsign,
  type RepeaterListing,
  type RepeaterSource,
} from '@integrations/repeaters/index.ts';
import { loadRepeaterBookToken } from '@integrations/preferences/index.ts';

export type RepeaterVerifyIntent = 'repeater' | 'talkGroups';

export type RepeaterVerifySource = Extract<
  RepeaterSource,
  'ukrepeater' | 'brandmeister' | 'irts' | 'repeaterbook'
>;

export const REPEATER_VERIFY_SOURCE_LABEL: Record<RepeaterVerifySource, string> = {
  ukrepeater: 'ukrepeater.net',
  brandmeister: 'BrandMeister',
  irts: 'IRTS',
  repeaterbook: 'RepeaterBook',
};

export function useRepeaterListingLookup(
  channel: Channel,
  onListingChosen: (listing: RepeaterListing, intent: RepeaterVerifyIntent) => void,
) {
  const [error, setError] = useState<string | null>(null);
  const [listings, setListings] = useState<RepeaterListing[]>([]);
  const [pickerIntent, setPickerIntent] = useState<RepeaterVerifyIntent>('repeater');
  const [pickerOpen, setPickerOpen] = useState(false);

  function chooseListing(listing: RepeaterListing, intent: RepeaterVerifyIntent) {
    onListingChosen(listing, intent);
  }

  async function runDirectoryCheck(
    source: RepeaterVerifySource,
    intent: RepeaterVerifyIntent,
    setLoading: (value: boolean) => void,
  ) {
    if (!channel.callsign.trim()) {
      return;
    }
    setLoading(true);
    setError(null);
    const sourceLabel = REPEATER_VERIFY_SOURCE_LABEL[source];
    try {
      if (source === 'repeaterbook' && !loadRepeaterBookToken().trim()) {
        setError('RepeaterBook token required — add your token in Settings.');
        return;
      }
      const results =
        source === 'brandmeister'
          ? await searchBrandmeisterByCallsign(channel.callsign)
          : source === 'irts'
            ? await searchIrtsByCallsign(channel.callsign)
            : source === 'repeaterbook'
              ? await searchRepeaterBookByCallsignAnyRegion(
                  channel.callsign,
                  loadRepeaterBookToken(),
                )
              : await searchUkRepeatersByCallsign(channel.callsign);
      if (results.length === 0) {
        setError(`No listings found for ${channel.callsign} on ${sourceLabel}.`);
        return;
      }
      const auto = matchListingForChannel(channel, results);
      if (auto) {
        chooseListing(auto, intent);
        return;
      }
      if (results.length === 1) {
        chooseListing(results[0]!, intent);
        return;
      }
      setListings(results);
      setPickerIntent(intent);
      setPickerOpen(true);
    } catch (err) {
      setError(
        err instanceof RepeaterDirectoryError ? err.message : `Could not query ${sourceLabel}.`,
      );
    } finally {
      setLoading(false);
    }
  }

  const pickerTitle =
    pickerIntent === 'repeater' ? 'Choose repeater listing' : 'Choose repeater for talk groups';

  return {
    error,
    listings,
    pickerIntent,
    pickerOpen,
    pickerTitle,
    setPickerOpen,
    runDirectoryCheck,
    chooseListing,
  };
}
