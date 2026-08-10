import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polygon, Polyline, TileLayer, useMap } from 'react-leaflet';
import type { LatLon } from '@core/domain/geo.ts';
import { computeMapView } from '@core/domain/mapView.ts';
import { computeSatelliteFootprint } from '@core/domain/satelliteTracking/footprint.ts';
import { splitAtAntimeridian } from '../SatelliteTrackMap/mapHelpers.ts';
import { useLiveSatellitePosition } from '../../routes/tracking/useLiveSatellitePosition.ts';
import { computeOrbitTrailSegments } from './orbitTrail.ts';
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
}

function MapViewController({ points }: { points: LatLon[] }) {
  const map = useMap();

  useEffect(() => {
    const action = computeMapView(points, { padding: [40, 40], maxZoom: 7, singlePointZoom: 3 });
    if (!action) return;
    if (action.type === 'setView') {
      map.setView(action.center, action.zoom);
      return;
    }
    map.fitBounds(L.latLngBounds(action.southWest, action.northEast), {
      padding: action.padding,
      maxZoom: action.maxZoom,
    });
  }, [map, points]);

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
    () => computeOrbitTrailSegments(tleLine1, tleLine2, meanMotionRevPerDay, anchorAt),
    [tleLine1, tleLine2, meanMotionRevPerDay, anchorAt],
  );

  // Footprint circles can themselves cross the antimeridian (e.g. a satellite near the date
  // line, or a wide footprint at high latitude) — split the same way as the ground track.
  const footprintSegments = useMemo(
    () => (footprint ? splitAtAntimeridian(footprint.points) : []),
    [footprint],
  );

  const boundsPoints = useMemo(() => {
    if (footprint) return footprint.points;
    if (live) return [live.position];
    return [];
  }, [footprint, live]);

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
        {pastSegments.map((segment, index) => (
          <Polyline
            key={`past-${index}`}
            positions={segment}
            pathOptions={{ color: '#4d7cff', weight: 2, dashArray: '6, 6' }}
          />
        ))}
        {futureSegments.map((segment, index) => (
          <Polyline
            key={`future-${index}`}
            positions={segment}
            pathOptions={{ color: '#4d7cff', weight: 2 }}
          />
        ))}
        {footprintSegments.map((segment, index) => (
          <Polygon
            key={`footprint-${index}`}
            positions={segment}
            pathOptions={{ color: '#f7b84d', weight: 1, fillOpacity: 0.08 }}
          />
        ))}
        {live ? <Marker position={live.position} icon={SATELLITE_DIV_ICON} /> : null}
        <MapViewController points={boundsPoints} />
      </MapContainer>
      {!live ? (
        <p className={classes.hint}>Acquiring live position for {satelliteName}…</p>
      ) : null}
    </div>
  );
}
