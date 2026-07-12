import { bandFromFrequencyMhz } from '@core/domain/bandCatalog.ts';
import type { RepeaterListing } from '../types.ts';
import { parseRepeaterBookModes } from './modeMapping.ts';

const BAND_ID_TO_WIRE: Record<string, string> = {
  '2m': '2M',
  '70cm': '70CM',
  '4m': '4M',
  '6m': '6M',
  '23cm': '23CM',
  '10m': '10M',
  '11m': '11M',
};

function stringField(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (value == null) return '';
  return String(value).trim();
}

function mhzStringToHz(value: string): number | null {
  if (!value) return null;
  const mhz = Number.parseFloat(value);
  return Number.isFinite(mhz) && mhz > 0 ? Math.round(mhz * 1_000_000) : null;
}

function parseToneHz(value: string): number | null {
  if (!value) return null;
  const hz = Number.parseFloat(value);
  return Number.isFinite(hz) && hz > 0 ? hz : null;
}

function bandWireLabelFromRxHz(rxHz: number | null): string {
  if (rxHz == null) return '';
  const band = bandFromFrequencyMhz(rxHz / 1_000_000);
  if (!band) return '';
  return BAND_ID_TO_WIRE[band.id] ?? band.id.toUpperCase();
}

function buildRemoteId(row: Record<string, unknown>): string {
  const stateId = stringField(row, 'State ID');
  const rptrId = stringField(row, 'Rptr ID');
  if (stateId && rptrId) return `${stateId}:${rptrId}`;
  if (rptrId) return rptrId;
  const callsign = stringField(row, 'Callsign');
  const country = stringField(row, 'Country');
  return `${country}:${callsign}:${stringField(row, 'Frequency')}`;
}

function buildName(row: Record<string, unknown>): string {
  const city = stringField(row, 'Nearest City');
  const landmark = stringField(row, 'Landmark');
  if (city && landmark) return `${city} (${landmark})`;
  return city || landmark;
}

function parseLocation(row: Record<string, unknown>): { lat: number; lon: number } | null {
  const lat = Number.parseFloat(stringField(row, 'Lat'));
  const lon = Number.parseFloat(stringField(row, 'Long'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat === 0 && lon === 0) return null;
  return { lat, lon };
}

/** Normalise one RepeaterBook export row to `RepeaterListing`. */
export function parseRepeaterBookListing(row: Record<string, unknown>): RepeaterListing | null {
  const callsign = stringField(row, 'Callsign');
  if (!callsign) return null;

  const rxFrequencyHz = mhzStringToHz(stringField(row, 'Frequency'));
  const txFrequencyHz = mhzStringToHz(stringField(row, 'Input Freq'));
  const toneHz =
    parseToneHz(stringField(row, 'TSQ')) ?? parseToneHz(stringField(row, 'PL'));
  const { modes, primaryMode, colourCode } = parseRepeaterBookModes(row);

  return {
    source: 'repeaterbook',
    remoteId: buildRemoteId(row),
    callsign,
    name: buildName(row),
    rxFrequencyHz,
    txFrequencyHz,
    toneHz,
    modes,
    primaryMode,
    colourCode,
    locator: null,
    location: parseLocation(row),
    band: bandWireLabelFromRxHz(rxFrequencyHz),
    status: stringField(row, 'Operational Status') || 'Unknown',
  };
}

export function parseRepeaterBookListings(rows: unknown[]): RepeaterListing[] {
  if (!Array.isArray(rows)) return [];
  const listings: RepeaterListing[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const listing = parseRepeaterBookListing(row as Record<string, unknown>);
    if (listing) listings.push(listing);
  }
  return listings;
}
