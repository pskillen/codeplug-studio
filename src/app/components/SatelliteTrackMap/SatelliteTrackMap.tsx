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
  selectedPass: SelectedPass | null;
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

function MapViewController({
  points,
  passKey,
}: {
  points: LatLon[];
  /** Stable identity for the selected pass — a change clears manual pan/zoom and re-fits. */
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
  drawBehindMin = 0,
  drawAheadMin = 0,
}: SatelliteTrackMapProps) {
  const segments = useMemo(() => {
    if (!selectedPass) return [];
    const { fromAt, toAt } = computeTrackBounds(
      selectedPass.aosAt,
      selectedPass.losAt,
      drawBehindMin,
      drawAheadMin,
    );
    const points = sampleGroundTrack(
      selectedPass.tleLine1,
      selectedPass.tleLine2,
      fromAt,
      toAt,
      GROUND_TRACK_STEP_SEC,
    );
    return splitAtAntimeridian(points);
  }, [selectedPass, drawBehindMin, drawAheadMin]);

  const renderedSegments = useMemo(() => duplicateSegmentsForWorldCopies(segments), [segments]);

  const boundsPoints = useMemo(() => {
    const points = segments.flat();
    if (observer) points.push([observer.lat, observer.lon]);
    return points;
  }, [segments, observer]);

  const passKey = selectedPass
    ? `${selectedPass.satelliteName}:${selectedPass.aosAt}:${selectedPass.losAt}`
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
        {renderedSegments.map((copy, index) => (
          <Polyline
            key={`${copy.worldOffset}-${index}`}
            positions={copy.segment}
            pathOptions={{ color: '#4d7cff', weight: 2 }}
          />
        ))}
        <MapViewController points={boundsPoints} passKey={passKey} />
      </MapContainer>
      {!selectedPass ? (
        <p className={classes.hint}>Select a pass below to preview its ground track.</p>
      ) : null}
    </div>
  );
}
