import { bandFromFrequencyMhz } from '@core/domain/bandCatalog.ts';
import { csvToTable } from '@core/import-export/csvParse.ts';
import type { ChannelMode } from '@core/models/libraryTypes.ts';
import { RepeaterDirectoryError, type RepeaterListing } from './types.ts';

export const IRTS_REPEATERS_API_PATH = '/api/irts/repeaters';

const BAND_ID_TO_WIRE: Record<string, string> = {
  '2m': '2M',
  '70cm': '70CM',
  '4m': '4M',
  '6m': '6M',
  '23cm': '23CM',
  '10m': '10M',
  '11m': '11M',
};

function columnIndex(headers: string[], name: string): number {
  return headers.findIndex((header) => header.trim() === name);
}

function mhzStringToHz(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const mhz = Number.parseFloat(value);
  return Number.isFinite(mhz) && mhz > 0 ? Math.round(mhz * 1_000_000) : null;
}

function parseToneHz(value: string | undefined): number | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || trimmed.toLowerCase() === 'off') return null;
  const hz = Number.parseFloat(trimmed);
  return Number.isFinite(hz) && hz > 0 ? hz : null;
}

function parseChannelName(raw: string): { callsign: string; name: string } {
  const trimmed = raw.trim();
  const space = trimmed.indexOf(' ');
  if (space < 0) return { callsign: trimmed, name: '' };
  return {
    callsign: trimmed.slice(0, space).trim(),
    name: trimmed.slice(space + 1).trim(),
  };
}

function bandWireLabelFromRxHz(rxHz: number | null): string {
  if (rxHz == null) return '';
  const band = bandFromFrequencyMhz(rxHz / 1_000_000);
  if (!band) return '';
  return BAND_ID_TO_WIRE[band.id] ?? band.id.toUpperCase();
}

function parseChannelType(
  channelType: string,
  colorCodeRaw: string,
  toneHz: number | null,
): Pick<RepeaterListing, 'modes' | 'primaryMode' | 'colourCode' | 'toneHz'> {
  const type = channelType.trim();
  if (type === 'D-Digital') {
    const cc = Number.parseInt(colorCodeRaw, 10);
    return {
      modes: ['dmr'],
      primaryMode: 'dmr',
      colourCode: Number.isFinite(cc) ? cc : null,
      toneHz: null,
    };
  }
  return {
    modes: ['fm'],
    primaryMode: 'fm',
    colourCode: null,
    toneHz,
  };
}

/** Parse IRTS Anytone 578 CSV text into normalised listings. */
export function parseIrtsAnytoneCsv(text: string): RepeaterListing[] {
  const { headers, rows } = csvToTable(text);
  if (!headers.length) return [];

  const nameIdx = columnIndex(headers, 'Channel Name');
  const rxIdx = columnIndex(headers, 'Receive Frequency');
  const txIdx = columnIndex(headers, 'Transmit Frequency');
  const typeIdx = columnIndex(headers, 'Channel Type');
  const encodeIdx = columnIndex(headers, 'CTCSS/DCS Encode');
  const ccIdx = columnIndex(headers, 'Color Code');

  if (nameIdx < 0 || rxIdx < 0 || txIdx < 0 || typeIdx < 0) {
    throw new RepeaterDirectoryError('Invalid IRTS repeater CSV — missing required columns.');
  }

  const listings: RepeaterListing[] = [];

  for (const row of rows) {
    const channelName = row[nameIdx]?.trim() ?? '';
    if (!channelName) continue;

    const { callsign, name } = parseChannelName(channelName);
    if (!callsign) continue;

    const rxFrequencyHz = mhzStringToHz(row[rxIdx]);
    const txFrequencyHz = mhzStringToHz(row[txIdx]);
    const toneHz = parseToneHz(row[encodeIdx]);
    const modeFields = parseChannelType(row[typeIdx] ?? '', row[ccIdx] ?? '', toneHz);

    const rxMhz = rxFrequencyHz != null ? (rxFrequencyHz / 1_000_000).toFixed(5) : 'unknown';

    listings.push({
      source: 'irts',
      remoteId: `${callsign}@${rxMhz}`,
      callsign,
      name,
      rxFrequencyHz,
      txFrequencyHz,
      toneHz: modeFields.toneHz,
      modes: modeFields.modes,
      primaryMode: modeFields.primaryMode,
      colourCode: modeFields.colourCode,
      locator: null,
      location: null,
      band: bandWireLabelFromRxHz(rxFrequencyHz),
      status: '',
    });
  }

  return listings;
}

export interface IrtsSearchFilters {
  query?: string;
  band?: string;
  modes?: ChannelMode[];
}

export function filterIrtsListings(
  listings: RepeaterListing[],
  filters: IrtsSearchFilters = {},
): RepeaterListing[] {
  let result = listings;
  if (filters.query?.trim()) {
    const needle = filters.query.trim().toUpperCase();
    result = result.filter(
      (listing) =>
        listing.callsign.toUpperCase().includes(needle) ||
        listing.name.toUpperCase().includes(needle),
    );
  }
  if (filters.band?.trim()) {
    const band = filters.band.trim().toUpperCase();
    result = result.filter((listing) => listing.band.toUpperCase() === band);
  }
  if (filters.modes?.length) {
    const wanted = new Set(filters.modes);
    result = result.filter((listing) => listing.modes.some((mode) => wanted.has(mode)));
  }
  return result;
}

let catalogueCache: RepeaterListing[] | null = null;

/** Clear in-memory catalogue cache (tests). */
export function clearIrtsCatalogueCache(): void {
  catalogueCache = null;
}

export async function fetchIrtsRepeaters(options?: {
  refresh?: boolean;
}): Promise<RepeaterListing[]> {
  if (!options?.refresh && catalogueCache) {
    return catalogueCache;
  }

  let response: Response;
  try {
    response = await fetch(IRTS_REPEATERS_API_PATH);
  } catch {
    throw new RepeaterDirectoryError(
      'Could not reach IRTS repeater listing — check your network connection.',
    );
  }

  if (!response.ok) {
    throw new RepeaterDirectoryError(
      `IRTS repeater listing returned ${response.status}.`,
      response.status,
    );
  }

  let text: string;
  try {
    text = await response.text();
  } catch {
    throw new RepeaterDirectoryError('Invalid response from IRTS repeater listing.');
  }

  const listings = parseIrtsAnytoneCsv(text);
  catalogueCache = listings;
  return listings;
}

export async function searchIrtsByCallsign(callsign: string): Promise<RepeaterListing[]> {
  const needle = callsign.trim().toUpperCase();
  if (!needle) return [];
  const all = await fetchIrtsRepeaters();
  return all.filter((listing) => listing.callsign.toUpperCase() === needle);
}

export async function searchIrtsCatalogue(
  filters: IrtsSearchFilters = {},
): Promise<RepeaterListing[]> {
  const all = await fetchIrtsRepeaters();
  return filterIrtsListings(all, filters);
}
