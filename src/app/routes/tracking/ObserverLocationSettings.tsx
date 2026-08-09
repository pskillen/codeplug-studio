import { useState } from 'react';
import { coordsToLocator, isValidLocator, locatorToCoords } from '@core/domain/maidenhead.ts';
import { Button, Panel, TextInput } from '../../components/v2/index.ts';
import { useTrackingSettings } from '../../state/useTrackingSettings.ts';
import classes from './ObserverLocationSettings.module.css';

/**
 * Per-project observer location for satellite pass prediction — HTML5
 * Geolocation or a Maidenhead grid square. Address search and map-pin drop
 * are a separate follow-up slice (#862).
 */
export default function ObserverLocationSettings() {
  const { settings, loading, save } = useTrackingSettings();
  const [locatorInput, setLocatorInput] = useState('');
  const [locatorError, setLocatorError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

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
        void save({
          positionSource: 'geolocation',
          location: { lat: position.coords.latitude, lon: position.coords.longitude },
          maidenheadLocator: coordsToLocator(position.coords.latitude, position.coords.longitude),
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

  const currentLabel = settings?.location
    ? `${settings.location.lat.toFixed(4)}, ${settings.location.lon.toFixed(4)}${
        settings.maidenheadLocator ? ` (${settings.maidenheadLocator})` : ''
      }`
    : 'Not set';

  return (
    <Panel title="Observer location" sub="Used to calculate satellite pass times for this project.">
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
    </Panel>
  );
}
