import type { AirbandAirportInput } from '@core/domain/airband/index.ts';
import { findExistingAirbandChannelMatch, isCivilAirbandHz } from '@core/domain/airband/index.ts';
import type { Channel } from '@core/models/library.ts';
import type { AirportListing } from '@integrations/aviation/index.ts';
import { haversineDistanceM } from '@core/domain/geoDistance.ts';
import { hzToMhzString } from '../lib/units.ts';

export function airportListingToAirbandInput(listing: AirportListing): AirbandAirportInput {
  return {
    name: listing.name,
    icao: listing.icao,
    iata: listing.iata,
    location: listing.location,
    frequencies: listing.frequencies.map((freq) => ({
      service: freq.service,
      rxFrequencyHz: freq.rxFrequencyHz,
    })),
  };
}

export function airportListingKey(listing: AirportListing): string {
  return `openaip:${listing.openAipId}`;
}

export function airportFrequencyKey(listing: AirportListing, frequencyIndex: number): string {
  return `${airportListingKey(listing)}:${frequencyIndex}`;
}

export function parseAirportFrequencyKey(
  key: string,
): { airportKey: string; frequencyIndex: number } | null {
  const lastColon = key.lastIndexOf(':');
  if (lastColon <= 0) return null;
  const airportKey = key.slice(0, lastColon);
  const frequencyIndex = Number(key.slice(lastColon + 1));
  if (!Number.isInteger(frequencyIndex) || frequencyIndex < 0) return null;
  return { airportKey, frequencyIndex };
}

export function formatAirportDistanceKm(
  listing: AirportListing,
  reference: { lat: number; lon: number } | null,
): string | null {
  if (!reference || !listing.location) return null;
  const metres = haversineDistanceM(
    reference.lat,
    reference.lon,
    listing.location.lat,
    listing.location.lon,
  );
  return `${(metres / 1000).toFixed(1)} km`;
}

export function formatFrequencyMhz(hz: number): string {
  return `${hzToMhzString(hz) ?? '—'} MHz`;
}

export function buildExistingAirbandChannelIndex(
  airports: readonly AirportListing[],
  channels: readonly Channel[],
): Map<string, Channel> {
  const index = new Map<string, Channel>();

  for (const airport of airports) {
    const input = airportListingToAirbandInput(airport);
    airport.frequencies.forEach((frequency, frequencyIndex) => {
      if (!isCivilAirbandHz(frequency.rxFrequencyHz)) return;
      const match = findExistingAirbandChannelMatch(
        input,
        frequency.service,
        frequency.rxFrequencyHz,
        channels,
      );
      if (match) {
        index.set(airportFrequencyKey(airport, frequencyIndex), match);
      }
    });
  }

  return index;
}
