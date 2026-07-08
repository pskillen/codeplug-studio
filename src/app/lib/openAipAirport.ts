import type { AirbandAirportInput } from '@core/domain/airband/index.ts';
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

export function formatAirportDistanceKm(
  listing: AirportListing,
  reference: { lat: number; lon: number } | null,
): string | null {
  if (!reference || !listing.location) return null;
  const metres = haversineDistanceM(reference.lat, reference.lon, listing.location.lat, listing.location.lon);
  return `${(metres / 1000).toFixed(1)} km`;
}

export function formatFrequencyMhz(hz: number): string {
  return `${hzToMhzString(hz) ?? '—'} MHz`;
}
