import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import type { LatLon } from '@core/domain/geo.ts';
import {
  computePropagationRing,
  GROUNDWAVE_MAX_RANGE_KM,
  skipZoneOuterRadiusM,
} from '@core/domain/hfPropagation/footprint.ts';
import type { RayPathResult } from '@core/domain/hfPropagation/types.ts';
import { computeMapView, type MapViewAction } from '@core/domain/mapView.ts';
import { MODE_COLORS } from '../HfPropagationGlobe/buildGlobeData.ts';
import { rayGroundTrack } from './mapGeometry.ts';
import classes from './PropagationTopDownMap.module.css';

export interface PropagationTopDownMapProps {
  transmitter: { lat: number; lon: number };
  rays: RayPathResult[];
}

const GROUNDWAVE_MAX_RANGE_M = GROUNDWAVE_MAX_RANGE_KM * 1000;
const GROUNDWAVE_RING_COLOR = MODE_COLORS.groundwave;
const SKIP_ZONE_RING_COLOR = '#ff6b6b';
const FALLBACK_RAY_COLOR = '#888888';

const TX_DIV_ICON = L.divIcon({
  className: classes.txMarkerWrap,
  html: `<div class="${classes.txMarker}"><div class="${classes.txDot}"></div></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

/**
 * Leaflet plan view of the skip-zone / groundwave rings and the first ray's ground track.
 * Same `rays` + transmitter as the 3D globe — does not start its own Worker request.
 */
export default function PropagationTopDownMap({ transmitter, rays }: PropagationTopDownMapProps) {
  const outerRadiusM = useMemo(
    () => skipZoneOuterRadiusM(rays, transmitter.lat, transmitter.lon),
    [rays, transmitter],
  );
  const skipZoneRing = useMemo(
    () =>
      outerRadiusM != null
        ? computePropagationRing(transmitter.lat, transmitter.lon, outerRadiusM)
        : null,
    [outerRadiusM, transmitter],
  );
  const groundwaveRing = useMemo(
    () => computePropagationRing(transmitter.lat, transmitter.lon, GROUNDWAVE_MAX_RANGE_M),
    [transmitter],
  );

  const rayTrack: LatLon[] = useMemo(() => rayGroundTrack(rays), [rays]);
  const rayColor = rays[0] ? MODE_COLORS[rays[0].mode] : FALLBACK_RAY_COLOR;

  const view = useMemo(
    () =>
      computeMapView([[transmitter.lat, transmitter.lon], ...rayTrack], {
        padding: [24, 24],
        maxZoom: 8,
        singlePointZoom: 5,
      }),
    [transmitter, rayTrack],
  );

  return (
    <div className={classes.wrapper}>
      <MapContainer
        center={[transmitter.lat, transmitter.lon]}
        zoom={5}
        className={classes.map}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[transmitter.lat, transmitter.lon]} icon={TX_DIV_ICON} />
        {groundwaveRing.length > 1 ? (
          <Polyline
            positions={groundwaveRing}
            pathOptions={{ color: GROUNDWAVE_RING_COLOR, weight: 1 }}
          />
        ) : null}
        {skipZoneRing && skipZoneRing.length > 1 ? (
          <Polyline
            positions={skipZoneRing}
            pathOptions={{ color: SKIP_ZONE_RING_COLOR, weight: 1, dashArray: '4,4' }}
          />
        ) : null}
        {rayTrack.length > 1 ? (
          <Polyline positions={rayTrack} pathOptions={{ color: rayColor, weight: 2 }} />
        ) : null}
        <ApplyMapView view={view} />
        <MapResizeFix />
      </MapContainer>
    </div>
  );
}

/** Applies a computed MapViewAction — same setView/fitBounds pattern as SatelliteTrackMap. */
function ApplyMapView({ view }: { view: MapViewAction | null }) {
  const map = useMap();
  useEffect(() => {
    if (!view) return;
    if (view.type === 'setView') {
      map.setView(view.center, view.zoom);
      return;
    }
    map.fitBounds(L.latLngBounds(view.southWest, view.northEast), {
      padding: view.padding,
      maxZoom: view.maxZoom,
    });
  }, [map, view]);
  return null;
}

function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const parent = container.parentElement;
    if (!parent) return;

    const refresh = () => {
      map.invalidateSize();
    };
    requestAnimationFrame(refresh);

    const observer = new ResizeObserver(() => refresh());
    observer.observe(parent);
    return () => observer.disconnect();
  }, [map]);
  return null;
}
