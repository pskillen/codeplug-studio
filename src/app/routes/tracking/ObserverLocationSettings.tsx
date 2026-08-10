import { useEffect, useState } from 'react';
import { coordsToLocator, isValidLocator, locatorToCoords } from '@core/domain/maidenhead.ts';
import {
  NominatimSearchError,
  searchNominatim,
  type NominatimSearchResult,
} from '@integrations/geocoding/nominatimClient.ts';
import {
  Button,
  Combobox,
  Panel,
  TextInput,
  type ComboboxOption,
} from '../../components/v2/index.ts';
import { useTrackingSettings } from '../../state/useTrackingSettings.ts';
import ObserverLocationMap from './ObserverLocationMap.tsx';
import classes from './ObserverLocationSettings.module.css';

const ADDRESS_SEARCH_DEBOUNCE_MS = 300;
const MIN_ADDRESS_QUERY_LENGTH = 3;

/**
 * Per-project observer location for satellite pass prediction — HTML5
 * Geolocation, a Maidenhead grid square, Nominatim address search, or a
 * draggable minimap pin (#862).
 */
export default function ObserverLocationSettings() {
  const { settings, loading, save } = useTrackingSettings();
  const [locatorInput, setLocatorInput] = useState('');
  const [locatorError, setLocatorError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const [addressQuery, setAddressQuery] = useState('');
  const [addressResults, setAddressResults] = useState<NominatimSearchResult[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  function handleUseGeolocation() {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not available in this browser.');
      return;
    }
    setGeoError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const computedLocator = coordsToLocator(
          position.coords.latitude,
          position.coords.longitude,
        );
        setLocatorInput(computedLocator);
        void save({
          positionSource: 'geolocation',
          location: { lat: position.coords.latitude, lon: position.coords.longitude },
          maidenheadLocator: computedLocator,
        });
      },
      (error) => {
        setLocating(false);
        setGeoError(error.message || 'Could not get your location.');
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function handleSetLocator() {
    const trimmed = locatorInput.trim();
    if (!isValidLocator(trimmed)) {
      setLocatorError('Enter a valid 4 or 6-character Maidenhead locator (e.g. IO85 or IO85vs).');
      return;
    }
    setLocatorError(null);
    const location = locatorToCoords(trimmed);
    void save({ positionSource: 'maidenhead', location, maidenheadLocator: trimmed.toUpperCase() });
  }

  // Debounced address search — mirrors useTrackingPasses.ts's setTimeout/cancelled pattern.
  // Nominatim's usage policy caps requests at 1/s; this debounce is the client-side
  // enforcement (the Pages Function proxy does not rate-limit).
  useEffect(() => {
    const trimmed = addressQuery.trim();
    let cancelled = false;

    const timer = setTimeout(() => {
      const run = async () => {
        if (trimmed.length < MIN_ADDRESS_QUERY_LENGTH) {
          if (!cancelled) {
            setAddressResults([]);
            setAddressError(null);
            setAddressLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setAddressLoading(true);
          setAddressError(null);
        }

        try {
          const results = await searchNominatim(trimmed);
          if (cancelled) return;
          setAddressResults(results);
          if (results.length === 0) setAddressError('No results found.');
        } catch (err) {
          if (cancelled) return;
          setAddressResults([]);
          setAddressError(
            err instanceof NominatimSearchError ? err.message : 'Address search failed.',
          );
        } finally {
          if (!cancelled) setAddressLoading(false);
        }
      };
      void run();
    }, ADDRESS_SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [addressQuery]);

  function handleSelectAddress(option: ComboboxOption<NominatimSearchResult>) {
    const { lat, lon } = option.value;
    const computedLocator = coordsToLocator(lat, lon);
    setAddressQuery('');
    setAddressResults([]);
    setAddressError(null);
    void save({
      positionSource: 'address',
      location: { lat, lon },
      maidenheadLocator: computedLocator,
    });
  }

  function handleMapChange(lat: number, lon: number) {
    const computedLocator = coordsToLocator(lat, lon);
    setLocatorInput(computedLocator);
    void save({
      positionSource: 'map',
      location: { lat, lon },
      maidenheadLocator: computedLocator,
    });
  }

  const addressComboboxOptions: ComboboxOption<NominatimSearchResult>[] =
    addressQuery.trim().length >= MIN_ADDRESS_QUERY_LENGTH
      ? addressResults.map((result) => ({ value: result, label: result.displayName }))
      : [];
  const addressEmptyMessage =
    addressQuery.trim().length > 0 && addressQuery.trim().length < MIN_ADDRESS_QUERY_LENGTH
      ? 'Type at least 3 characters'
      : (addressError ?? 'No results');

  const currentLabel = settings?.location
    ? `${settings.location.lat.toFixed(4)}, ${settings.location.lon.toFixed(4)}${
        settings.maidenheadLocator ? ` (${settings.maidenheadLocator})` : ''
      }`
    : 'Not set';

  return (
    <Panel title="Observer location" sub="Used to calculate satellite pass times for this project.">
      <div className={classes.layout}>
        <div className={classes.inputsColumn}>
          <p className={classes.current}>
            Current: <strong>{loading ? 'Loading…' : currentLabel}</strong>
          </p>

          <div className={classes.row}>
            <Button variant="secondary" onClick={handleUseGeolocation} disabled={locating}>
              {locating ? 'Locating…' : 'Use my location'}
            </Button>
            {geoError ? <span className={classes.error}>{geoError}</span> : null}
          </div>

          <div className={classes.row}>
            <TextInput
              label="Maidenhead locator"
              placeholder="IO85vs"
              value={locatorInput}
              onChange={(event) => setLocatorInput(event.target.value)}
            />
            <Button variant="secondary" onClick={handleSetLocator}>
              Set
            </Button>
          </div>
          {locatorError ? <span className={classes.error}>{locatorError}</span> : null}

          <div className={classes.section}>
            <span className={classes.sectionLabel}>Search address</span>
            <Combobox
              inputValue={addressQuery}
              onInputChange={setAddressQuery}
              options={addressComboboxOptions}
              loading={addressLoading}
              onSelect={handleSelectAddress}
              placeholder="Search an address or place…"
              emptyMessage={addressEmptyMessage}
            />
          </div>
        </div>

        <div className={classes.mapColumn}>
          <span className={classes.sectionLabel}>Or drop a pin</span>
          <ObserverLocationMap value={settings?.location ?? null} onChange={handleMapChange} />
        </div>
      </div>
    </Panel>
  );
}
