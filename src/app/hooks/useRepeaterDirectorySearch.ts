import { useCallback, useState } from 'react';
import type { ChannelMode } from '@core/models/libraryTypes.ts';
import {
  RepeaterDirectoryError,
  detectQueryKind,
  fetchIrtsRepeaters,
  searchBrandmeisterByCallsign,
  searchIrtsCatalogue,
  searchUkRepeaters,
  type QueryKind,
  type RepeaterListing,
  type RepeaterSource,
} from '@integrations/repeaters/index.ts';
import { bandFromWireLabel } from '../lib/bands.ts';
import { useMapSettings } from './useMapSettings.ts';

export interface RepeaterDirectorySearchState {
  query: string;
  operationalOnly: boolean;
  bandFilter: string | null;
  modeFilter: string[];
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
  const [modeFilter, setModeFilter] = useState<string[]>([]);
  const [titleCaseNames, setTitleCaseNames] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<QueryKind | null>(null);
  const [listings, setListings] = useState<RepeaterListing[]>([]);

  const search = useCallback(
    async (queryOverride?: string) => {
      const trimmed = (queryOverride ?? query).trim();

      setLoading(true);
      setError(null);
      try {
        if (source === 'brandmeister') {
          if (!trimmed) {
            setError('Enter a callsign.');
            return;
          }
          const results = await searchBrandmeisterByCallsign(trimmed);
          setKind(null);
          setListings(results);
          if (results.length === 0) {
            setError('No repeaters matched your search on BrandMeister.');
          }
          return;
        }

        if (source === 'irts') {
          await fetchIrtsRepeaters();
          const results = await searchIrtsCatalogue({
            query: trimmed || undefined,
            band: bandFilter ?? undefined,
            modes: modeFilter.length ? (modeFilter as ChannelMode[]) : undefined,
          });
          setKind(null);
          setListings(results);
          if (results.length === 0) {
            const narrow =
              bandFilter || modeFilter.length ? ' Try clearing band or mode filters.' : '';
            setError(
              trimmed
                ? `No repeaters matched your search in the IRTS catalogue.${narrow}`
                : `No repeaters in the IRTS catalogue.${narrow}`,
            );
          }
          return;
        }

        if (!trimmed) {
          setError('Enter a callsign, locator, or town.');
          return;
        }

        if (detectQueryKind(trimmed) === 'band') {
          const bandValue = trimmed.toUpperCase();
          setBandFilter(bandValue);
          setKind('band');
          setListings([]);
          const label = bandFromWireLabel(bandValue)?.label ?? bandValue;
          setError(`Band filter set to ${label} — enter a callsign, locator, or town to search.`);
          return;
        }

        const result = await searchUkRepeaters(
          trimmed,
          {
            operationalOnly,
            band: bandFilter ?? undefined,
            modes: modeFilter.length ? (modeFilter as ChannelMode[]) : undefined,
          },
          {
            mapboxToken: mapboxToken.trim() || undefined,
          },
        );
        setKind(result.kind);
        setListings(result.listings);
        if (result.listings.length === 0) {
          const narrow =
            bandFilter || modeFilter.length ? ' Try clearing band or mode filters.' : '';
          setError(`No repeaters matched your search on ukrepeater.net.${narrow}`);
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
    [query, operationalOnly, bandFilter, modeFilter, mapboxToken, source],
  );

  return {
    query,
    setQuery,
    operationalOnly,
    setOperationalOnly,
    bandFilter,
    setBandFilter,
    modeFilter,
    setModeFilter,
    titleCaseNames,
    setTitleCaseNames,
    loading,
    error,
    kind,
    listings,
    search,
  };
}
