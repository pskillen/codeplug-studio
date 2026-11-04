import { IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { formatDistanceM, haversineDistanceM } from '@core/domain/geoDistance.ts';
import { coordsToLocator } from '@core/domain/maidenhead.ts';
import { GeocodeError, searchPlaces, type GeocodeResult } from '@integrations/geocode/index.ts';
import { useMapSettings } from '../../hooks/useMapSettings.ts';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';
import { Button, FormField, TextInput } from '../v2/index.ts';
import classes from './ChannelPlaceSearch.module.css';

export interface ChannelPlaceSearchProps {
  /** Place name taken from the channel name (`placeQueryFromChannelName`), or null when there is none. */
  nameQuery: string | null;
  /** Current position, used to rank results and show how far each one is. */
  near: { lat: number; lon: number } | null;
  /** Called with the chosen result. */
  onPick: (lat: number, lon: number, label: string) => void;
}

/**
 * Find a channel's position by place: one click searches the town in the channel name, or type an
 * address, town or postcode. Results are offered, never applied, and nothing is sent until Search.
 */
export default function ChannelPlaceSearch({ nameQuery, near, onPick }: ChannelPlaceSearchProps) {
  const { mapboxToken } = useMapSettings();
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState<string | null>(null);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moved, setMoved] = useState<string | null>(null);

  const run = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setLoading(true);
    setError(null);
    setMoved(null);
    try {
      const found = await searchPlaces(trimmed, {
        near: near ?? undefined,
        mapboxToken: mapboxToken.trim() || undefined,
      });
      setResults(found);
      setSearched(trimmed);
    } catch (err) {
      setResults([]);
      setSearched(null);
      setError(err instanceof GeocodeError ? err.message : 'Place search failed.');
    } finally {
      setLoading(false);
    }
  };

  const pick = (result: GeocodeResult) => {
    onPick(result.lat, result.lon, result.label);
    setMoved(result.label);
    setResults([]);
    setSearched(null);
  };

  const provider = mapboxToken.trim() ? 'Mapbox' : 'OpenStreetMap (Photon)';

  return (
    <div className={classes.root}>
      <FormField
        label="Find a place"
        error={error ?? undefined}
        hint={`Searches ${provider}. Only the text you search is sent.`}
      >
        <form
          className={classes.row}
          onSubmit={(e) => {
            e.preventDefault();
            void run(query);
          }}
        >
          <TextInput
            variant="plain"
            value={query}
            placeholder="Town, address or postcode"
            onChange={(e) => setQuery(e.currentTarget.value)}
            aria-label="Find a place"
          />
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            loading={loading}
            disabled={!query.trim()}
            leftSection={<IconSearch size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
          >
            Search
          </Button>
        </form>
      </FormField>

      {nameQuery && searched !== nameQuery ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={classes.nameButton}
          disabled={loading}
          onClick={() => void run(nameQuery)}
        >
          Find “{nameQuery}” from the channel name
        </Button>
      ) : null}

      {searched != null && results.length === 0 ? (
        <p className={classes.note}>No places found for “{searched}”.</p>
      ) : null}

      {results.length > 0 ? (
        <ul className={classes.results} aria-label="Place results">
          {results.map((result) => {
            const distance =
              near != null
                ? formatDistanceM(haversineDistanceM(near.lat, near.lon, result.lat, result.lon))
                : null;
            return (
              <li key={`${result.lat},${result.lon},${result.label}`} className={classes.result}>
                <div className={classes.resultText}>
                  <span className={classes.resultLabel}>{result.label}</span>
                  <span className={classes.resultMeta}>
                    {result.kind ? `${result.kind} · ` : ''}
                    {coordsToLocator(result.lat, result.lon, 6)}
                    {distance ? ` · ${distance} from current position` : ''}
                  </span>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => pick(result)}>
                  Move here
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {moved ? (
        <p className={classes.note} role="status">
          Moved to {moved}. Check the marker, then save.
        </p>
      ) : null}
    </div>
  );
}
