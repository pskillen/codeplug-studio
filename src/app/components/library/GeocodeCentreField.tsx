import { IconMapPin } from '@tabler/icons-react';
import { useDebouncedValue } from '@mantine/hooks';
import { useEffect, useMemo, useState } from 'react';
import { coordsToLocator } from '@core/domain/maidenhead.ts';
import { GeocodeError, geocodeQuery, type GeocodeProvider } from '@integrations/geocode/index.ts';
import { Combobox, type ComboboxOption, SegmentedControl } from '../v2/index.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';

const GEOCODE_DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 3;

const GEOCODE_PROVIDER_OPTIONS: { value: GeocodeProvider; label: string }[] = [
  { value: 'mapbox', label: 'Mapbox' },
  { value: 'photon', label: 'Photon (OSM)' },
];

export interface GeocodeCentreValue {
  lat: number;
  lon: number;
  label?: string;
}

export interface GeocodeCentreFieldProps {
  mapboxToken: string;
  centre: GeocodeCentreValue | null;
  onCentreChange: (lat: number, lon: number, label?: string) => void;
  onClearCentre: () => void;
  geocodeProvider: GeocodeProvider;
  onGeocodeProviderChange: (provider: GeocodeProvider) => void;
}

export default function GeocodeCentreField({
  mapboxToken,
  centre,
  onCentreChange,
  onClearCentre,
  geocodeProvider,
  onGeocodeProviderChange,
}: GeocodeCentreFieldProps) {
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery] = useDebouncedValue(inputValue, GEOCODE_DEBOUNCE_MS);
  const [options, setOptions] = useState<ComboboxOption<GeocodeCentreValue>[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const hasMapboxToken = mapboxToken.trim().length > 0;

  const committed = useMemo((): ComboboxOption<GeocodeCentreValue> | null => {
    if (!centre) return null;
    const locator = coordsToLocator(centre.lat, centre.lon, 6);
    const label = centre.label?.trim();
    return {
      value: centre,
      label: label ? `${label} (${locator})` : locator,
    };
  }, [centre]);

  const trimmedDebounced = debouncedQuery.trim();
  const shouldSearch = !centre && trimmedDebounced.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!shouldSearch) return;

    const query = trimmedDebounced;
    let cancelled = false;

    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setSearchError(null);

      try {
        const result = await geocodeQuery(query, {
          mapboxToken,
          provider: geocodeProvider,
        });
        if (cancelled) return;
        if (!result) {
          setOptions([]);
          setSearchError('No results found');
          return;
        }
        setOptions([
          {
            value: { lat: result.lat, lon: result.lon, label: result.label },
            label: result.label,
          },
        ]);
      } catch (err) {
        if (cancelled) return;
        setOptions([]);
        setSearchError(err instanceof GeocodeError ? err.message : 'Geocoding failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shouldSearch, trimmedDebounced, geocodeProvider, mapboxToken]);

  const comboboxOptions = shouldSearch ? options : [];
  const comboboxLoading = shouldSearch && loading;
  const emptyMessage =
    trimmedDebounced.length > 0 && trimmedDebounced.length < MIN_QUERY_LENGTH
      ? 'Type at least 3 characters'
      : (searchError ?? 'No results');

  return (
    <div>
      <Combobox
        value={committed}
        inputValue={inputValue}
        onInputChange={setInputValue}
        options={comboboxOptions}
        loading={comboboxLoading}
        onSelect={(option) => {
          onCentreChange(option.value.lat, option.value.lon, option.value.label ?? option.label);
          setInputValue('');
          setOptions([]);
          setSearchError(null);
        }}
        onClear={() => {
          onClearCentre();
          setInputValue('');
          setOptions([]);
          setSearchError(null);
        }}
        placeholder="Search city or postcode…"
        emptyMessage={emptyMessage}
        icon={<IconMapPin size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
      />
      <div style={{ marginTop: 10 }}>
        <SegmentedControl
          options={GEOCODE_PROVIDER_OPTIONS}
          value={geocodeProvider}
          onChange={(value) => onGeocodeProviderChange(value as GeocodeProvider)}
          disabled={!hasMapboxToken && geocodeProvider === 'mapbox'}
        />
      </div>
      {!hasMapboxToken ? (
        <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--dsv2-text-tertiary)' }}>
          Add a Mapbox token in Settings to use Mapbox geocoding. Photon (OSM) works without a
          token.
        </p>
      ) : null}
    </div>
  );
}
