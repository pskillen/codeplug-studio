import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Polygon, Polyline, TileLayer, useMap } from 'react-leaflet';
import type { LatLon } from '@core/domain/geo.ts';
import { computeWorldRepeatMapView } from '@core/domain/mapView.ts';
import { computeSatelliteFootprint } from '@core/domain/satelliteTracking/footprint.ts';
import {
  duplicateSegmentsForWorldCopies,
  splitRingAtAntimeridian,
} from '../SatelliteTrackMap/mapHelpers.ts';
import { useLiveSatellitePosition } from '../../routes/tracking/useLiveSatellitePosition.ts';
import { computeOrbitTrailSegments, DEFAULT_ORBIT_TRAIL_MULTIPLE } from './orbitTrail.ts';
import classes from './SatelliteLiveMap.module.css';

const DEFAULT_CENTER: LatLon = [20, 0];
const DEFAULT_ZOOM = 2;

/**
 * Live satellite-position marker icon. Hoisted to a module-level singleton, matching
 * `observerDivIcon` in `SatelliteTrackMap/mapHelpers.ts` — a distinct look (amber dot vs.
 * the observer's blue dot) so the two marker kinds are visually distinguishable on the same
 * map, and rebuilding it per render would trip the same `Marker`-icon-reference bug documented
 * in that module's history.
 */
const SATELLITE_DIV_ICON = L.divIcon({
  className: classes.satelliteMarkerWrap,
  html: `<div class="${classes.satelliteMarker}"><div class="${classes.satelliteDot}"></div></div>`,
  iconAnchor: [7, 7],
});

export interface SatelliteLiveMapProps {
  satelliteName: string;
  tleLine1: string;
  tleLine2: string;
  /** Orbital mean motion, revolutions/day — used to derive the orbit-trail time window. */
  meanMotionRevPerDay: number;
  /** Orbital periods to draw ahead and behind the anchor. Default 1.5 each way. */
  orbitTrailMultiple?: number;
}

function MapViewController() {
  const map = useMap();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const action = computeWorldRepeatMapView({ padding: [12, 12], maxZoom: 3 });
    map.fitBounds(L.latLngBounds(action.southWest, action.northEast), {
      padding: action.padding,
      maxZoom: action.maxZoom,
    });
  }, [map]);

  return null;
}

/**
 * Live position + visible-horizon footprint + orbit-trail map for the satellite detail page.
 * New sibling to `SatelliteTrackMap` rather than a `mode` switch on it — that component is
 * shaped around a single AOS→LOS pass preview (one static track, one observer marker); this
 * one continuously re-propagates a moving marker/footprint and draws two independent orbit
 * segments. Both components share antimeridian-splitting and marker-icon conventions from
 * `SatelliteTrackMap/mapHelpers.ts` rather than duplicating that logic.
 */
export default function SatelliteLiveMap({
  satelliteName,
  tleLine1,
  tleLine2,
  meanMotionRevPerDay,
  orbitTrailMultiple = DEFAULT_ORBIT_TRAIL_MULTIPLE,
}: SatelliteLiveMapProps) {
  // Anchor instant for the orbit-trail window, fixed at mount (not recomputed on every
  // live-position poll tick) — the trail is a stable "1.5 orbits either side of roughly now"
  // ribbon; the live marker moves smoothly along/near it via useLiveSatellitePosition below.
  const [anchorAt] = useState(() => Date.now());

  const live = useLiveSatellitePosition(tleLine1, tleLine2);

  const footprint = useMemo(() => {
    if (!live) return null;
    return computeSatelliteFootprint(tleLine1, tleLine2, live.at);
  }, [tleLine1, tleLine2, live]);

  const { futureSegments, pastSegments } = useMemo(
    () =>
      computeOrbitTrailSegments(
        tleLine1,
        tleLine2,
        meanMotionRevPerDay,
        anchorAt,
        undefined,
        orbitTrailMultiple,
      ),
    [tleLine1, tleLine2, meanMotionRevPerDay, anchorAt, orbitTrailMultiple],
  );

  const renderedPastSegments = useMemo(
    () => duplicateSegmentsForWorldCopies(pastSegments),
    [pastSegments],
  );
  const renderedFutureSegments = useMemo(
    () => duplicateSegmentsForWorldCopies(futureSegments),
    [futureSegments],
  );

  // Footprint circles can themselves cross the antimeridian (e.g. a satellite near the date
  // line, or a wide footprint at high latitude). Unlike the ground track/orbit trail, the
  // footprint is a *closed ring* — splitRingAtAntimeridian closes each fragment against the
  // seam instead of leaving an open arc for Leaflet's Polygon to auto-close incorrectly.
  const footprintSegments = useMemo(
    () => (footprint ? splitRingAtAntimeridian(footprint.points) : []),
    [footprint],
  );
  const renderedFootprintSegments = useMemo(
    () => duplicateSegmentsForWorldCopies(footprintSegments),
    [footprintSegments],
  );

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
        {renderedPastSegments.map((copy, index) => (
          <Polyline
            key={`past-${copy.worldOffset}-${index}`}
            positions={copy.segment}
            pathOptions={{ color: '#4d7cff', weight: 2, dashArray: '6, 6' }}
          />
        ))}
        {renderedFutureSegments.map((copy, index) => (
          <Polyline
            key={`future-${copy.worldOffset}-${index}`}
            positions={copy.segment}
            pathOptions={{ color: '#4d7cff', weight: 2 }}
          />
        ))}
        {renderedFootprintSegments.map((copy, index) => (
          <Polygon
            key={`footprint-${copy.worldOffset}-${index}`}
            positions={copy.segment}
            pathOptions={{ color: '#f7b84d', weight: 1, fillOpacity: 0.08 }}
          />
        ))}
        {live ? <Marker position={live.position} icon={SATELLITE_DIV_ICON} /> : null}
        <MapViewController />
      </MapContainer>
      {!live ? <p className={classes.hint}>Acquiring live position for {satelliteName}…</p> : null}
    </div>
  );
}
