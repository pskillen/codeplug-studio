import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { IconArrowsUpDown } from '@tabler/icons-react';
import {
  formatCoordParam,
  formatDistanceInUnit,
  formatLocatorDisplay,
  parseLatLon,
  pathMetricsBetween,
  type DistanceUnit,
} from '@core/domain/fieldGeo.ts';
import { compassOctant } from '@core/domain/geoDistance.ts';
import { coordsToLocator } from '@core/domain/maidenhead.ts';
import FieldMap, { type FieldMapPin } from '../../components/FieldTools/FieldMap.tsx';
import MapToolLayout from '../../components/FieldTools/MapToolLayout.tsx';
import PlaceInput from '../../components/FieldTools/PlaceInput.tsx';
import { Button } from '../../components/v2/index.ts';
import { useDistanceUnit } from '../../hooks/useDistanceUnit.ts';
import { useGeolocation } from '../../hooks/useGeolocation.ts';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';
import { placeFromCoords, type Place, type PlaceKind } from '../../lib/resolvePlace.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { useProjects } from '../../state/useProjects.ts';
import Chip from './Chip.tsx';
import classes from './FieldTools.module.css';

const A_COLOUR = '#4f8cff';
const B_COLOUR = '#e8590c';

function readPlace(
  params: URLSearchParams,
  prefix: 'a' | 'b',
  fallbackKind: PlaceKind,
): Place | null {
  const p = parseLatLon(params.get(`${prefix}lat`), params.get(`${prefix}lon`));
  if (!p) return null;
  const label = params.get(`${prefix}l`) || undefined;
  return placeFromCoords(p.lat, p.lon, fallbackKind, label);
}

function writePlace(next: URLSearchParams, prefix: 'a' | 'b', place: Place | null) {
  next.delete(`${prefix}lat`);
  next.delete(`${prefix}lon`);
  next.delete(`${prefix}l`);
  if (!place) return;
  next.set(`${prefix}lat`, formatCoordParam(place.lat));
  next.set(`${prefix}lon`, formatCoordParam(place.lon));
  next.set(`${prefix}l`, place.label);
}

/** Distance & bearing: two draggable pins, a big readout, nothing saved. State lives in the URL. */
export default function BearingPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { activeProjectId } = useProjects();
  const { library } = useLibrary();
  const { requestLocation } = useGeolocation();
  const [unit, setUnit] = useDistanceUnit();
  const [fitNonce, setFitNonce] = useState(0);

  // Points are local state (initialised from the URL once) and mirrored back into the URL.
  const [initial] = useState(() => ({
    a: readPlace(params, 'a', 'gps'),
    b: readPlace(params, 'b', 'map'),
  }));
  const [a, setA] = useState<Place | null>(initial.a);
  const [b, setB] = useState<Place | null>(initial.b);
  const channels = activeProjectId ? library.channels : [];

  const update = useCallback(
    (nextA: Place | null, nextB: Place | null, refit: boolean) => {
      setA(nextA);
      setB(nextB);
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          writePlace(next, 'a', nextA);
          writePlace(next, 'b', nextB);
          return next;
        },
        { replace: true },
      );
      if (refit) setFitNonce((n) => n + 1);
    },
    [setParams],
  );

  // A defaults to my location unless the URL already carries one.
  useEffect(() => {
    if (a) return;
    let cancelled = false;
    void requestLocation().then((r) => {
      if (cancelled || !r) return;
      update(placeFromCoords(r.lat, r.lon, 'gps', 'My location'), b, true);
    });
    return () => {
      cancelled = true;
    };
    // Only on first open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const metrics = useMemo(
    () =>
      a && b ? pathMetricsBetween({ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon }) : null,
    [a, b],
  );
  const otherUnit: DistanceUnit = unit === 'mi' ? 'km' : 'mi';

  const pins: FieldMapPin[] = [
    ...(a
      ? [{ id: 'a', lat: a.lat, lon: a.lon, label: 'A', colour: A_COLOUR, draggable: true }]
      : []),
    ...(b
      ? [{ id: 'b', lat: b.lat, lon: b.lon, label: 'B', colour: B_COLOUR, draggable: true }]
      : []),
  ];

  const dragged = (id: string, lat: number, lon: number) => {
    const moved = placeFromCoords(lat, lon, 'map');
    if (id === 'a') update(moved, b, false);
    else update(a, moved, false);
  };

  const swap = () => update(b, a, true);

  const nearbyB = b
    ? `/tools/nearby?${new URLSearchParams({
        lat: formatCoordParam(b.lat),
        lon: formatCoordParam(b.lon),
        pl: b.label,
      }).toString()}`
    : null;

  const readout = (
    <div className={classes.readout} aria-live="polite">
      {metrics ? (
        <>
          <div className={classes.readoutBlock}>
            <div className={classes.eyebrow}>Distance</div>
            <div className={classes.readoutValue}>
              {formatDistanceInUnit(metrics.distanceM, unit)}
            </div>
            <div className={classes.readoutSub}>
              {formatDistanceInUnit(metrics.distanceM, otherUnit)}
            </div>
          </div>
          <div className={classes.readoutBlock}>
            <div className={classes.eyebrow}>Bearing A → B</div>
            <div className={classes.readoutValue}>
              {Math.round(metrics.bearingAB) % 360}°{' '}
              <span className={classes.readoutUnit}>{compassOctant(metrics.bearingAB)}</span>
            </div>
            <div className={classes.readoutSub}>Return {Math.round(metrics.bearingBA) % 360}°</div>
          </div>
        </>
      ) : (
        <div className={classes.status}>
          {a ? 'Set point B to see distance and bearing.' : 'Waiting for point A…'}
        </div>
      )}
    </div>
  );

  const unitChips = (
    <div className={classes.chips} role="group" aria-label="Distance unit">
      {(['mi', 'km'] as const).map((u) => (
        <Chip key={u} active={u === unit} onClick={() => setUnit(u)}>
          {u}
        </Chip>
      ))}
    </div>
  );

  const inputs = (
    <>
      <div className={classes.pointRows}>
        <PlaceInput
          label="Point A"
          badge={{ text: 'A', colour: A_COLOUR }}
          place={a}
          onPlace={(p) => update(p, b, true)}
          channels={channels}
          clearable
        />
        <div className={classes.swap}>
          <Button
            variant="secondary"
            size="sm"
            aria-label="Swap A and B"
            disabled={!a && !b}
            leftSection={<IconArrowsUpDown size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
            onClick={swap}
          >
            Swap
          </Button>
        </div>
        <PlaceInput
          label="Point B"
          badge={{ text: 'B', colour: B_COLOUR }}
          place={b}
          onPlace={(p) => update(a, p, true)}
          channels={channels}
          allowGps={false}
          clearable
        />
      </div>
      <div className={classes.hintText}>
        Tap the map to move B · drag either pin · each point accepts a locator, address
        {activeProjectId ? ' or a library channel' : ''}.
      </div>
      <div className={classes.chipRow}>
        <span className={classes.chipLabel}>Unit</span>
        {unitChips}
      </div>
      {a ? (
        <div className={classes.status}>
          A: {formatLocatorDisplay(coordsToLocator(a.lat, a.lon, 6))}
          {b ? ` · B: ${formatLocatorDisplay(coordsToLocator(b.lat, b.lon, 6))}` : ''}
        </div>
      ) : null}
      <div className={classes.links}>
        <Button
          variant="secondary"
          disabled={!nearbyB}
          onClick={() => nearbyB && navigate(nearbyB)}
        >
          Repeaters near B →
        </Button>
      </div>
    </>
  );

  return (
    <MapToolLayout
      title="Distance & bearing"
      description="Distance and bearing between two points. Nothing is saved; the link is shareable."
      mapHint="Click the map to move B · drag either pin"
      sheetHeader={readout}
      desktopLead={<div className={classes.card}>{readout}</div>}
      sheetLabel="Distance and bearing"
      initialSnap="half"
      map={
        <FieldMap
          pins={pins}
          line={
            a && b
              ? [
                  [a.lat, a.lon],
                  [b.lat, b.lon],
                ]
              : null
          }
          onMapClick={(lat, lon) => update(a, placeFromCoords(lat, lon, 'map'), !b)}
          onPinDrag={dragged}
          fitKey={`bearing:${fitNonce}`}
          fitInsetBottomPx={320}
          fitMaxZoom={13}
        />
      }
    >
      {inputs}
    </MapToolLayout>
  );
}
