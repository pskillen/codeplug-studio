import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { LatLon } from '@core/domain/geo.ts';
import { computeMapView } from '@core/domain/mapView.ts';
import { sampleGroundTrack } from '@core/domain/satelliteTracking/groundTrack.ts';
import {
  observerDivIcon,
  duplicateSegmentsForWorldCopies,
  splitAtAntimeridian,
} from './mapHelpers.ts';
import classes from './SatelliteTrackMap.module.css';

const GROUND_TRACK_STEP_SEC = 30;
const DEFAULT_CENTER: LatLon = [20, 0];
const DEFAULT_ZOOM = 2;

export interface SelectedPass {
  satelliteName: string;
  tleLine1: string;
  tleLine2: string;
  aosAt: string;
  losAt: string;
}

export interface SatelliteTrackMapProps {
  observer: { lat: number; lon: number } | null;
  /** When set, draws only this pass and overrides `defaultPasses`. */
  selectedPass: SelectedPass | null;
  /** Next pass per filtered satellite when no row is selected. */
  defaultPasses?: SelectedPass[];
  /** Minutes to extend the drawn track before the pass's `aosAt`. Default 0 (strict AOS start). */
  drawBehindMin?: number;
  /** Minutes to extend the drawn track past the pass's `losAt`. Default 0 (strict LOS end). */
  drawAheadMin?: number;
}

/**
 * Compute the sampling bounds for a ground track given the pass window and the
 * operator's draw-ahead/draw-behind extension. `drawBehindMin` pushes the start
 * earlier than `aosAt`; `drawAheadMin` pushes the end later than `losAt` — both
 * relative to the pass window, not wall-clock "now".
 */
export function computeTrackBounds(
  aosAt: string,
  losAt: string,
  drawBehindMin: number,
  drawAheadMin: number,
): { fromAt: string; toAt: string } {
  const fromAt = new Date(new Date(aosAt).getTime() - drawBehindMin * 60_000).toISOString();
  const toAt = new Date(new Date(losAt).getTime() + drawAheadMin * 60_000).toISOString();
  return { fromAt, toAt };
}

function samplePassSegments(
  pass: SelectedPass,
  drawBehindMin: number,
  drawAheadMin: number,
): LatLon[][] {
  const { fromAt, toAt } = computeTrackBounds(pass.aosAt, pass.losAt, drawBehindMin, drawAheadMin);
  const points = sampleGroundTrack(
    pass.tleLine1,
    pass.tleLine2,
    fromAt,
    toAt,
    GROUND_TRACK_STEP_SEC,
  );
  return splitAtAntimeridian(points);
}

function MapViewController({
  points,
  passKey,
}: {
  points: LatLon[];
  /** Stable identity for the selected/default pass set — a change clears manual pan/zoom and re-fits. */
  passKey: string | null;
}) {
  const map = useMap();
  const userInteractedRef = useRef(false);
  const lastPassKeyRef = useRef<string | null>(null);

  useMapEvents({
    dragstart: () => {
      userInteractedRef.current = true;
    },
    zoomstart: () => {
      userInteractedRef.current = true;
    },
  });

  useEffect(() => {
    if (passKey !== lastPassKeyRef.current) {
      lastPassKeyRef.current = passKey;
      userInteractedRef.current = false;
    }
  }, [passKey]);

  useEffect(() => {
    if (userInteractedRef.current) return;

    const action = computeMapView(points, { padding: [40, 40], maxZoom: 8, singlePointZoom: 4 });
    if (!action) return;
    if (action.type === 'setView') {
      map.setView(action.center, action.zoom);
      return;
    }
    map.fitBounds(L.latLngBounds(action.southWest, action.northEast), {
      padding: action.padding,
      maxZoom: action.maxZoom,
    });
  }, [map, points, passKey]);

  return null;
}

/**
 * 2D ground-track preview for a selected satellite pass. New sibling to
 * `CodeplugMap` (that component is tightly coupled to Channel/Zone domain) —
 * reuses `computeMapView` for auto-fit bounds and the same `L.divIcon`
 * marker convention.
 */
export default function SatelliteTrackMap({
  observer,
  selectedPass,
  defaultPasses = [],
  drawBehindMin = 0,
  drawAheadMin = 0,
}: SatelliteTrackMapProps) {
  const passesToDraw = useMemo(
    () => (selectedPass ? [selectedPass] : defaultPasses),
    [selectedPass, defaultPasses],
  );

  const trackLayers = useMemo(() => {
    return passesToDraw.map((pass) => {
      const segments = samplePassSegments(pass, drawBehindMin, drawAheadMin);
      return {
        key: `${pass.satelliteName}:${pass.aosAt}:${pass.losAt}`,
        rendered: duplicateSegmentsForWorldCopies(segments),
      };
    });
  }, [passesToDraw, drawBehindMin, drawAheadMin]);

  const boundsPoints = useMemo(() => {
    const points: LatLon[] = [];
    for (const layer of trackLayers) {
      for (const copy of layer.rendered) {
        points.push(...copy.segment);
      }
    }
    if (observer) points.push([observer.lat, observer.lon]);
    return points;
  }, [trackLayers, observer]);

  const passKey = selectedPass
    ? `${selectedPass.satelliteName}:${selectedPass.aosAt}:${selectedPass.losAt}`
    : defaultPasses.length > 0
      ? defaultPasses.map((pass) => `${pass.satelliteName}:${pass.aosAt}`).join('|')
      : null;

  return (
    <div className={classes.wrapper}>
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        className={classes.map}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {observer ? (
          <Marker position={[observer.lat, observer.lon]} icon={observerDivIcon()} />
        ) : null}
        {trackLayers.flatMap((layer) =>
          layer.rendered.map((copy, index) => (
            <Polyline
              key={`${layer.key}:${copy.worldOffset}-${index}`}
              positions={copy.segment}
              pathOptions={{ color: '#4d7cff', weight: 2 }}
            />
          )),
        )}
        <MapViewController points={boundsPoints} passKey={passKey} />
      </MapContainer>
      {!selectedPass && defaultPasses.length === 0 ? (
        <p className={classes.hint}>No upcoming passes to preview for the current filter window.</p>
      ) : null}
    </div>
  );
}
