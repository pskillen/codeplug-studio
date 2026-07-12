import { useCallback, useState } from 'react';
import type { ChannelMode } from '@core/models/libraryTypes.ts';
import {
  RepeaterDirectoryError,
  detectQueryKind,
  fetchIrtsRepeaters,
  searchBrandmeisterByCallsign,
  searchIrtsCatalogue,
  searchRepeaterBook,
  searchUkRepeaters,
  type ListingGeometryFilter,
  type QueryKind,
  type RepeaterBookRegion,
  type RepeaterListing,
  type RepeaterSource,
} from '@integrations/repeaters/index.ts';
import { loadRepeaterBookToken } from '@integrations/preferences/index.ts';
import { bandFromWireLabel } from '../lib/bands.ts';
import { useMapSettings } from './useMapSettings.ts';
import { useRepeaterBookSettings } from './useRepeaterBookSettings.ts';

export interface RepeaterDirectorySearchState {
  query: string;
  operationalOnly: boolean;
  bandFilter: string[];
  modeFilter: string[];
  geometryFilter: ListingGeometryFilter;
  titleCaseNames: boolean;
  loading: boolean;
  error: string | null;
  kind: QueryKind | null;
  listings: RepeaterListing[];
}

function narrowFilterHint(
  bandFilter: string[],
  modeFilter: string[],
  geometryFilter: ListingGeometryFilter,
): string {
  const parts: string[] = [];
  if (bandFilter.length) parts.push('band');
  if (modeFilter.length) parts.push('mode');
  if (geometryFilter !== 'all') parts.push('geometry');
  if (!parts.length) return '';
  return ` Try clearing ${parts.join(' or ')} filters.`;
}

export function useRepeaterDirectorySearch(source: RepeaterSource) {
  const { mapboxToken } = useMapSettings();
  const { hasToken: hasRepeaterBookToken } = useRepeaterBookSettings();
  const [query, setQuery] = useState('');
  const [operationalOnly, setOperationalOnly] = useState(true);
  const [bandFilter, setBandFilter] = useState<string[]>([]);
  const [modeFilter, setModeFilter] = useState<string[]>([]);
  const [geometryFilter, setGeometryFilter] = useState<ListingGeometryFilter>('all');
  const [titleCaseNames, setTitleCaseNames] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<QueryKind | null>(null);
  const [listings, setListings] = useState<RepeaterListing[]>([]);
  const [region, setRegion] = useState<RepeaterBookRegion>('na');
  const [stateId, setStateId] = useState('');
  const [country, setCountry] = useState('');

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
            bands: bandFilter.length ? bandFilter : undefined,
            modes: modeFilter.length ? (modeFilter as ChannelMode[]) : undefined,
          });
          setKind(null);
          setListings(results);
          if (results.length === 0) {
            const narrow = narrowFilterHint(bandFilter, modeFilter, 'all');
            setError(
              trimmed
                ? `No repeaters matched your search in the IRTS catalogue.${narrow}`
                : `No repeaters in the IRTS catalogue.${narrow}`,
            );
          }
          return;
        }

        if (source === 'repeaterbook') {
          const token = loadRepeaterBookToken();
          if (!token.trim()) {
            setError('RepeaterBook token required.');
            return;
          }
          const results = await searchRepeaterBook(
            {
              region,
              token,
              callsign: trimmed || undefined,
              stateId: region === 'na' ? stateId : undefined,
              country: country || undefined,
            },
            {
              operationalOnly,
              bands: bandFilter.length ? bandFilter : undefined,
              geometry: geometryFilter,
              modes: modeFilter.length ? (modeFilter as ChannelMode[]) : undefined,
            },
          );
          setKind(null);
          setListings(results);
          if (results.length === 0) {
            const narrow = narrowFilterHint(bandFilter, modeFilter, geometryFilter);
            setError(`No repeaters matched your search on RepeaterBook.${narrow}`);
          }
          return;
        }

        if (!trimmed) {
          setError('Enter a callsign, locator, or town.');
          return;
        }

        if (detectQueryKind(trimmed) === 'band') {
          const bandValue = trimmed.toUpperCase();
          setBandFilter([bandValue]);
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
            bands: bandFilter.length ? bandFilter : undefined,
            geometry: geometryFilter,
            modes: modeFilter.length ? (modeFilter as ChannelMode[]) : undefined,
          },
          {
            mapboxToken: mapboxToken.trim() || undefined,
          },
        );
        setKind(result.kind);
        setListings(result.listings);
        if (result.listings.length === 0) {
          const narrow = narrowFilterHint(bandFilter, modeFilter, geometryFilter);
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
    [query, operationalOnly, bandFilter, modeFilter, geometryFilter, mapboxToken, source, region, stateId, country],
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
    geometryFilter,
    setGeometryFilter,
    titleCaseNames,
    setTitleCaseNames,
    loading,
    error,
    kind,
    listings,
    search,
    region,
    setRegion,
    stateId,
    setStateId,
    country,
    setCountry,
    hasToken: source === 'repeaterbook' ? hasRepeaterBookToken : true,
  };
}
