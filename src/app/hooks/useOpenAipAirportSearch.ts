import { useCallback, useState } from 'react';
import type { AirportListing, AirportQueryKind } from '@integrations/aviation/index.ts';
import {
  AviationDirectoryError,
  routeAirportQuery,
  sortAirportsByDistance,
} from '@integrations/aviation/index.ts';
import { useMapSettings } from './useMapSettings.ts';
import { useOpenAipSettings } from './useOpenAipSettings.ts';

export function useOpenAipAirportSearch() {
  const { mapboxToken } = useMapSettings();
  const { openAipApiKey } = useOpenAipSettings();

  const [query, setQuery] = useState('');
  const [radiusKm, setRadiusKm] = useState(50);
  const [alsoCreateZone, setAlsoCreateZone] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<AirportQueryKind | null>(null);
  const [airports, setAirports] = useState<AirportListing[]>([]);
  const [referencePoint, setReferencePoint] = useState<{ lat: number; lon: number } | null>(null);

  const search = useCallback(
    async (queryOverride?: string, coords?: { lat: number; lon: number }) => {
      const trimmed = (queryOverride ?? query).trim();
      if (!coords && !trimmed) {
        setError('Enter an ICAO/IATA code, airport name, locator, or town.');
        return;
      }

      if (!openAipApiKey.trim()) {
        setError('OpenAIP API key is not configured.');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const result = await routeAirportQuery(trimmed, {
          apiKey: openAipApiKey,
          radiusKm,
          mapboxToken: mapboxToken.trim() || undefined,
          coords,
        });
        setKind(result.kind);
        const sorted =
          result.referencePoint != null
            ? sortAirportsByDistance(result.airports, result.referencePoint)
            : result.airports;
        setAirports(sorted);
        setReferencePoint(result.referencePoint ?? null);
        if (sorted.length === 0) {
          setError('No airports matched your search on OpenAIP.');
        }
      } catch (err) {
        setAirports([]);
        setKind(null);
        setReferencePoint(null);
        setError(
          err instanceof AviationDirectoryError ? err.message : 'Search failed. Please try again.',
        );
      } finally {
        setLoading(false);
      }
    },
    [query, radiusKm, openAipApiKey, mapboxToken],
  );

  return {
    query,
    setQuery,
    radiusKm,
    setRadiusKm,
    alsoCreateZone,
    setAlsoCreateZone,
    loading,
    error,
    kind,
    airports,
    referencePoint,
    hasApiKey: openAipApiKey.trim().length > 0,
    search,
  };
}
