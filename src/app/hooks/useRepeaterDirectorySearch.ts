import { useCallback, useState } from 'react';
import {
  RepeaterDirectoryError,
  searchBrandmeisterByCallsign,
  searchUkRepeaters,
  type QueryKind,
  type RepeaterListing,
  type RepeaterSource,
} from '@integrations/repeaters/index.ts';
import { useMapSettings } from './useMapSettings.ts';

export interface RepeaterDirectorySearchState {
  query: string;
  operationalOnly: boolean;
  bandFilter: string | null;
  titleCaseNames: boolean;
  loading: boolean;
  error: string | null;
  kind: QueryKind | null;
  listings: RepeaterListing[];
}

export function useRepeaterDirectorySearch(source: RepeaterSource) {
  const { mapboxToken } = useMapSettings();
  const [query, setQuery] = useState('');
  const [operationalOnly, setOperationalOnly] = useState(true);
  const [bandFilter, setBandFilter] = useState<string | null>(null);
  const [titleCaseNames, setTitleCaseNames] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<QueryKind | null>(null);
  const [listings, setListings] = useState<RepeaterListing[]>([]);

  const search = useCallback(
    async (queryOverride?: string) => {
      const trimmed = (queryOverride ?? query).trim();
      if (!trimmed) {
        setError('Enter a callsign, locator, band, or town.');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        if (source === 'brandmeister') {
          const results = await searchBrandmeisterByCallsign(trimmed);
          setKind(null);
          setListings(results);
          if (results.length === 0) {
            setError('No repeaters matched your search on BrandMeister.');
          }
          return;
        }

        const result = await searchUkRepeaters(
          trimmed,
          {
            operationalOnly,
            band: bandFilter ?? undefined,
          },
          {
            mapboxToken: mapboxToken.trim() || undefined,
          },
        );
        setKind(result.kind);
        setListings(result.listings);
        if (result.listings.length === 0) {
          setError('No repeaters matched your search on ukrepeater.net.');
        }
      } catch (err) {
        setListings([]);
        setKind(null);
        setError(
          err instanceof RepeaterDirectoryError ? err.message : 'Search failed. Please try again.',
        );
      } finally {
        setLoading(false);
      }
    },
    [query, operationalOnly, bandFilter, mapboxToken, source],
  );

  return {
    query,
    setQuery,
    operationalOnly,
    setOperationalOnly,
    bandFilter,
    setBandFilter,
    titleCaseNames,
    setTitleCaseNames,
    loading,
    error,
    kind,
    listings,
    search,
  };
}
