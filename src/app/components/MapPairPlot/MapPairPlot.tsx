import L from 'leaflet';
import { Anchor, Group } from '@mantine/core';
import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { LatLon } from '@core/domain/geo.ts';
import { computeMapView } from '@core/domain/mapView.ts';
import MaidenheadGridLayer from '../CodeplugMap/MaidenheadGridLayer.tsx';
import '../CodeplugMap/CodeplugMap.css';
import { useDocumentLayoutReady } from '../../hooks/useDocumentLayoutReady.ts';
import { useMapSettings } from '../../hooks/useMapSettings.ts';
import { SETTINGS_MAP_SECTION_ID } from '../../lib/settingsSections.ts';

const DEFAULT_CENTER: [number, number] = [56.5, -4.0];
const DEFAULT_ZOOM = 6;
const FROM_COLOUR = '#228be6';
const TO_COLOUR = '#fa5252';

export interface MapPairPoint {
  lat: number;
  lon: number;
}

export type MapPairPickTarget = 'from' | 'to';

function markerIcon(colour: string, label: string): L.DivIcon {
  return L.divIcon({
    className: 'map-pair-plot-marker',
    html: `<div style="display:flex;flex-direction:column;align-items:center;pointer-events:none"><div style="width:14px;height:14px;border-radius:50%;background:${colour};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div><span style="font-size:10px;font-weight:600;background:rgba(255,255,255,0.92);padding:0 3px;border-radius:2px;margin-top:2px;line-height:1.2">${label}</span></div>`,
    iconSize: [28, 32],
    iconAnchor: [14, 16],
  });
}

function MapClickHandler({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapPairViewSync({ points }: { points: LatLon[] }) {
  const map = useMap();
  const pointsKey = points.map((p) => `${p[0]},${p[1]}`).join('|');

  useEffect(() => {
    const action = computeMapView(points, {
      padding: [32, 32],
      maxZoom: 12,
      singlePointZoom: 11,
    });
    if (!action) return;

    if (action.type === 'setView') {
      map.setView(action.center, action.zoom);
      return;
    }

    map.fitBounds(L.latLngBounds(action.southWest, action.northEast), {
      padding: action.padding,
      maxZoom: action.maxZoom,
    });
  }, [map, pointsKey, points]);

  return null;
}

function MapResizeFix() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const parent = container.parentElement;
    if (!parent) return;

    const refresh = () => {
      if (document.readyState !== 'complete') return;
      map.invalidateSize();
    };

    const onLoad = () => refresh();
    if (document.readyState === 'complete') {
      requestAnimationFrame(refresh);
    } else {
      window.addEventListener('load', onLoad, { once: true });
    }

    const observer = new ResizeObserver(() => refresh());
    observer.observe(parent);

    return () => {
      window.removeEventListener('load', onLoad);
      observer.disconnect();
    };
  }, [map]);

  return null;
}

export interface MapPairPlotProps {
  pointFrom: MapPairPoint | null;
  pointTo: MapPairPoint | null;
  labelFrom?: string;
  labelTo?: string;
  onPick: (lat: number, lon: number) => void;
  pickTarget: MapPairPickTarget;
  height?: number | string;
  /** When false, render a sized placeholder without MapContainer (avoids Leaflet reuse errors). */
  active?: boolean;
}

export default function MapPairPlot({
  pointFrom,
  pointTo,
  labelFrom = 'From',
  labelTo = 'To',
  onPick,
  height = 200,
  active = true,
}: MapPairPlotProps) {
  const mapLayoutReady = useDocumentLayoutReady();
  const { maidenheadGrid } = useMapSettings();

  const hasFrom = pointFrom != null;
  const hasTo = pointTo != null;
  const hasAny = hasFrom || hasTo;

  const center: [number, number] = hasFrom
    ? [pointFrom.lat, pointFrom.lon]
    : hasTo
      ? [pointTo.lat, pointTo.lon]
      : DEFAULT_CENTER;

  const viewPoints = useMemo((): LatLon[] => {
    const pts: LatLon[] = [];
    if (hasFrom) pts.push([pointFrom.lat, pointFrom.lon]);
    if (hasTo) pts.push([pointTo.lat, pointTo.lon]);
    return pts;
  }, [hasFrom, hasTo, pointFrom, pointTo]);

  const linePositions = useMemo((): LatLon[] | null => {
    if (!hasFrom || !hasTo) return null;
    return [
      [pointFrom.lat, pointFrom.lon],
      [pointTo.lat, pointTo.lon],
    ];
  }, [hasFrom, hasTo, pointFrom, pointTo]);

  const mapStyle = typeof height === 'number' ? { height: `${height}px` } : { height };

  return (
    <div className="codeplug-map-wrap">
      <Group justify="flex-end" align="center" className="codeplug-map-toolbar">
        <Anchor
          component={Link}
          to="/settings"
          state={{ scrollTo: SETTINGS_MAP_SECTION_ID }}
          size="xs"
          c="dimmed"
        >
          Map settings
        </Anchor>
      </Group>

      <div className="codeplug-map" style={mapStyle}>
        {active && mapLayoutReady ? (
          <MapContainer
            center={center}
            zoom={hasAny ? 11 : DEFAULT_ZOOM}
            preferCanvas
            style={{ height: '100%', width: '100%' }}
          >
            <MapResizeFix />
            <MapClickHandler onPick={onPick} />
            {viewPoints.length > 0 ? <MapPairViewSync points={viewPoints} /> : null}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MaidenheadGridLayer mode={maidenheadGrid} />
            {linePositions ? (
              <Polyline
                positions={linePositions}
                pathOptions={{ color: '#495057', weight: 2, opacity: 0.75, dashArray: '6 4' }}
              />
            ) : null}
            {hasFrom ? (
              <Marker
                position={[pointFrom.lat, pointFrom.lon]}
                icon={markerIcon(FROM_COLOUR, labelFrom)}
              />
            ) : null}
            {hasTo ? (
              <Marker position={[pointTo.lat, pointTo.lon]} icon={markerIcon(TO_COLOUR, labelTo)} />
            ) : null}
          </MapContainer>
        ) : null}
      </div>
    </div>
  );
}
