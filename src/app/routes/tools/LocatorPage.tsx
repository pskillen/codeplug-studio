import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { IconCopy, IconRefresh, IconShare } from '@tabler/icons-react';
import {
  formatCoordParam,
  formatLocatorDisplay,
  locatorSquareBounds,
  parseLatLon,
} from '@core/domain/fieldGeo.ts';
import { coordsToLocator, type LocatorPrecision } from '@core/domain/maidenhead.ts';
import FieldMap, { type FieldMapPin } from '../../components/FieldTools/FieldMap.tsx';
import MapToolLayout from '../../components/FieldTools/MapToolLayout.tsx';
import PlaceInput from '../../components/FieldTools/PlaceInput.tsx';
import { Button } from '../../components/v2/index.ts';
import { useGeolocation } from '../../hooks/useGeolocation.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { useProjects } from '../../state/useProjects.ts';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';
import { placeFromCoords, type Place } from '../../lib/resolvePlace.ts';
import Chip from './Chip.tsx';
import classes from './FieldTools.module.css';

const PRECISIONS: LocatorPrecision[] = [4, 6, 8];

function canShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/** My locator: opens to a GPS fix and shows one big answer. Nothing is saved. */
export default function LocatorPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { activeProjectId } = useProjects();
  const { library } = useLibrary();
  const { requestLocation, loading, error, accuracyMeters } = useGeolocation();
  const [precision, setPrecision] = useState<LocatorPrecision>(6);
  const [copied, setCopied] = useState(false);

  const fromUrl = parseLatLon(params.get('lat'), params.get('lon'));
  const place: Place | null = fromUrl
    ? placeFromCoords(fromUrl.lat, fromUrl.lon, params.get('src') === 'gps' ? 'gps' : 'map')
    : null;

  const setPlace = useCallback(
    (p: Place | null, source: 'gps' | 'map' = 'map') => {
      setParams(
        p ? { lat: formatCoordParam(p.lat), lon: formatCoordParam(p.lon), src: source } : {},
        { replace: true },
      );
    },
    [setParams],
  );

  const refresh = useCallback(async () => {
    const r = await requestLocation();
    if (r) setPlace(placeFromCoords(r.lat, r.lon, 'gps'), 'gps');
  }, [requestLocation, setPlace]);

  // Ask for GPS on open unless a point was passed in the URL.
  useEffect(() => {
    if (!fromUrl) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locator = place
    ? formatLocatorDisplay(coordsToLocator(place.lat, place.lon, precision))
    : null;
  const isGps = params.get('src') === 'gps';
  const square = locator ? locatorSquareBounds(locator) : null;
  const pins: FieldMapPin[] = place
    ? [{ id: 'me', lat: place.lat, lon: place.lon, label: '', colour: '#4f8cff' }]
    : [];

  const shareText = place ? `${locator} (${place.lat.toFixed(5)}, ${place.lon.toFixed(5)})` : '';

  const copy = async () => {
    if (!locator) return;
    try {
      await navigator.clipboard.writeText(locator);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be blocked; nothing else to do.
    }
  };

  const share = async () => {
    if (!place) return;
    if (canShare()) {
      try {
        await navigator.share({ title: 'My locator', text: shareText });
      } catch {
        // User dismissed the share sheet.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const goTo = (path: string) => navigate(path);
  const bearingHref = place
    ? `/tools/bearing?${new URLSearchParams({
        alat: formatCoordParam(place.lat),
        alon: formatCoordParam(place.lon),
        al: isGps ? 'My location' : (locator ?? ''),
      }).toString()}`
    : '';
  const nearbyHref = place
    ? `/tools/nearby?${new URLSearchParams({
        lat: formatCoordParam(place.lat),
        lon: formatCoordParam(place.lon),
        pl: isGps ? 'My location' : (locator ?? ''),
      }).toString()}`
    : '';

  const card = (
    <div className={`${classes.card} ${classes.cardCentered}`}>
      <div className={classes.eyebrow}>
        {place
          ? isGps
            ? `Your locator · GPS${accuracyMeters != null ? ` ±${Math.round(accuracyMeters)} m` : ''}`
            : 'Locator · picked point'
          : loading
            ? 'Finding you…'
            : 'No position yet'}
      </div>
      <div className={classes.bigLocator} aria-live="polite">
        {locator ?? '—'}
      </div>
      {place ? (
        <div className={classes.coords}>
          {Math.abs(place.lat).toFixed(4)}° {place.lat >= 0 ? 'N' : 'S'},{' '}
          {Math.abs(place.lon).toFixed(4)}° {place.lon >= 0 ? 'E' : 'W'}
        </div>
      ) : null}
      <div className={classes.chips} role="group" aria-label="Locator precision">
        {PRECISIONS.map((p) => (
          <Chip key={p} active={p === precision} onClick={() => setPrecision(p)}>
            {place ? formatLocatorDisplay(coordsToLocator(place.lat, place.lon, p)) : `${p} chars`}
          </Chip>
        ))}
      </div>
      <div className={classes.actions}>
        <Button
          variant="primary"
          disabled={!place}
          leftSection={<IconCopy size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
          onClick={() => void copy()}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button
          variant="secondary"
          disabled={!place}
          leftSection={<IconShare size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
          onClick={() => void share()}
        >
          Share
        </Button>
        <Button
          variant="secondary"
          loading={loading}
          leftSection={<IconRefresh size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
          onClick={() => void refresh()}
        >
          Refresh
        </Button>
      </div>
      {error ? (
        <div className={classes.error} role="alert">
          {error}. Look up a place below instead, or tap the map.
        </div>
      ) : null}
    </div>
  );

  const rest = (
    <>
      <PlaceInput
        label="Look up a place"
        placeholder="Look up a locator, address or postcode…"
        place={null}
        onPlace={(p) => p && setPlace(p)}
        channels={activeProjectId ? library.channels : []}
        allowGps={false}
      />
      <div className={classes.links}>
        <Button variant="secondary" disabled={!place} onClick={() => goTo(bearingHref)}>
          Distance from here →
        </Button>
        <Button variant="secondary" disabled={!place} onClick={() => goTo(nearbyHref)}>
          Repeaters near here →
        </Button>
      </div>
    </>
  );

  return (
    <MapToolLayout
      title="My locator"
      description="Your Maidenhead locator from GPS. Nothing is saved."
      mobile="stack"
      mapHint="Tap the map to look up elsewhere"
      afterMap={rest}
      map={
        <FieldMap
          pins={pins}
          square={square}
          onMapClick={(lat, lon) => setPlace(placeFromCoords(lat, lon, 'map'))}
          fitKey={place ? `${locator}` : 'none'}
          fitMaxZoom={14}
        />
      }
    >
      {card}
    </MapToolLayout>
  );
}
