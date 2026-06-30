import { locatorToCoords } from '@core/domain/maidenhead.ts';
import { RepeaterDirectoryError, type RepeaterListing } from './types.ts';
import { parseUkRepeaterModeCodes } from './ukrepeater/modeCodes.ts';

const ETCC_API_BASE = 'https://api-beta.rsgb.online';

/** Raw RSGB / ETCC listing shape (tx/rx in Hz, ctcss in Hz). */
interface EtccListing {
  id: number;
  status?: string;
  town?: string;
  repeater: string;
  modeCodes?: string[];
  tx?: number;
  rx?: number;
  ctcss?: number;
  band?: string;
  locator?: string;
}

interface EtccResponse {
  data: EtccListing[] | null;
}

function normalise(listing: EtccListing): RepeaterListing {
  const { modes, primaryMode, colourCode } = parseUkRepeaterModeCodes(listing.modeCodes ?? []);
  return {
    source: 'ukrepeater',
    remoteId: String(listing.id),
    callsign: listing.repeater,
    name: listing.town ?? '',
    rxFrequencyHz: listing.tx && listing.tx > 0 ? listing.tx : null,
    txFrequencyHz: listing.rx && listing.rx > 0 ? listing.rx : null,
    toneHz: listing.ctcss && listing.ctcss > 0 ? listing.ctcss : null,
    modes,
    primaryMode,
    colourCode,
    locator: listing.locator ?? null,
    location: listing.locator ? locatorToCoords(listing.locator) : null,
    band: listing.band ?? '',
    status: listing.status ?? '',
  };
}

async function fetchListings(path: string): Promise<RepeaterListing[]> {
  let response: Response;
  try {
    response = await fetch(`${ETCC_API_BASE}/${path}`);
  } catch {
    throw new RepeaterDirectoryError(
      'Could not reach ukrepeater.net — check your network connection.',
    );
  }
  if (!response.ok) {
    throw new RepeaterDirectoryError(
      `ukrepeater.net returned ${response.status}.`,
      response.status,
    );
  }
  let parsed: EtccResponse;
  try {
    parsed = (await response.json()) as EtccResponse;
  } catch {
    throw new RepeaterDirectoryError('Invalid response from ukrepeater.net.');
  }
  return Array.isArray(parsed.data) ? parsed.data.map(normalise) : [];
}

export function searchUkRepeatersByCallsign(callsign: string): Promise<RepeaterListing[]> {
  return fetchListings(`callsign/${encodeURIComponent(callsign.trim().toLowerCase())}`);
}

export function searchUkRepeatersByLocator(locator: string): Promise<RepeaterListing[]> {
  return fetchListings(`locator/${encodeURIComponent(locator.trim().toLowerCase())}`);
}
