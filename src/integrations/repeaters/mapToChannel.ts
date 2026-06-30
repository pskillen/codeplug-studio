import { newChannel } from '@core/domain/factories.ts';
import type {
  Channel,
  ChannelModeProfileDMR,
  ChannelModeProfileFM,
  ChannelTone,
} from '@core/models/library.ts';
import type { RepeaterListing } from './types.ts';

/**
 * Map a normalised repeater listing into a vendor-neutral library `Channel`.
 * Lives in integrations (it depends on the external listing shape) but produces
 * only core model fields — no wire strings leak into the library.
 */
export function repeaterListingToChannel(listing: RepeaterListing, projectId: string): Channel {
  const base = newChannel(projectId, listing.callsign || listing.name || 'Repeater');
  const tone: ChannelTone = listing.toneHz ? String(listing.toneHz) : 'none';

  const profile: ChannelModeProfileFM | ChannelModeProfileDMR =
    listing.mode === 'dmr'
      ? {
          mode: 'dmr',
          colourCode: listing.colourCode,
          timeslot: null,
          dmrId: null,
          contactRef: null,
          rxGroupListId: null,
        }
      : { mode: 'fm', squelch: null, rxTone: tone, txTone: tone };

  const name =
    listing.callsign && listing.name
      ? `${listing.callsign} ${listing.name}`
      : listing.callsign || listing.name || base.name;

  return {
    ...base,
    name,
    callsign: listing.callsign,
    rxFrequency: listing.rxFrequencyHz,
    txFrequency: listing.txFrequencyHz,
    location: listing.location,
    useLocation: listing.location !== null,
    comment: [listing.name, listing.status].filter((s) => s.length > 0).join(' — '),
    modeProfiles: [profile],
  };
}
