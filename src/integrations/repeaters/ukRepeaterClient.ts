import { locatorToCoords } from '@core/domain/maidenhead.ts';
import { RepeaterDirectoryError, type RepeaterListing, type RepeaterMode } from './types.ts';

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

function parseMode(modeCodes: string[]): { mode: RepeaterMode; colourCode: number | null } {
  let hasAnalog = false;
  let hasDmr = false;
  let colourCode: number | null = null;
  for (const raw of modeCodes) {
    const code = raw.trim().toUpperCase();
    if (code === 'A') hasAnalog = true;
    else if (code === 'D' || code === 'M') hasDmr = true;
    else if (code.startsWith('D:') || code.startsWith('M:')) {
      hasDmr = true;
      const n = Number.parseInt(code.slice(2), 10);
      if (Number.isFinite(n) && n >= 0 && n <= 15) colourCode = n;
    }
  }
  const mode: RepeaterMode = hasAnalog ? 'fm' : hasDmr ? 'dmr' : 'other';
  return { mode, colourCode: mode === 'dmr' ? colourCode : null };
}

function normalise(listing: EtccListing): RepeaterListing {
  const { mode, colourCode } = parseMode(listing.modeCodes ?? []);
  return {
    source: 'ukrepeater',
    remoteId: String(listing.id),
    callsign: listing.repeater,
    name: listing.town ?? '',
    rxFrequencyHz: listing.tx && listing.tx > 0 ? listing.tx : null,
    txFrequencyHz: listing.rx && listing.rx > 0 ? listing.rx : null,
    toneHz: listing.ctcss && listing.ctcss > 0 ? listing.ctcss : null,
    mode,
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
