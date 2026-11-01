import L from 'leaflet';
import { useEffect, useMemo } from 'react';
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  Rectangle,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import type { LatLonBounds } from '@core/domain/fieldGeo.ts';
import MaidenheadGridLayer from '../CodeplugMap/MaidenheadGridLayer.tsx';
import '../CodeplugMap/CodeplugMap.css';
import { useDocumentLayoutReady } from '../../hooks/useDocumentLayoutReady.ts';
import { useMapSettings } from '../../hooks/useMapSettings.ts';

const DEFAULT_CENTER: [number, number] = [54.5, -3.5];
const DEFAULT_ZOOM = 5;

export interface FieldMapPin {
  id: string;
  lat: number;
  lon: number;
  /** Short text inside the pin (A, B, or empty for a plain reference dot). */
  label: string;
  colour: string;
  draggable?: boolean;
}

export interface FieldMapMarker {
  id: string;
  lat: number;
  lon: number;
  /** Rank number shown in the marker. */
  label: string;
  colour: string;
  selected?: boolean;
}

export interface FieldMapRing {
  lat: number;
  lon: number;
  radiusM: number;
}

export interface FieldMapProps {
  pins?: readonly FieldMapPin[];
  markers?: readonly FieldMapMarker[];
  ring?: FieldMapRing | null;
  /** Outline of a locator square. */
  square?: LatLonBounds | null;
  /** Dashed line between two points (A to B). */
  line?: readonly [[number, number], [number, number]] | null;
  onMapClick?: (lat: number, lon: number) => void;
  onPinDrag?: (id: string, lat: number, lon: number) => void;
  onMarkerClick?: (id: string) => void;
  /** Re-fit the view whenever this key changes (not on every render). */
  fitKey: string;
  /** Extra padding at the bottom when a sheet covers part of the map, in px. */
  fitInsetBottomPx?: number;
  /** Highest zoom the automatic fit may reach. */
  fitMaxZoom?: number;
}

function pinIcon(pin: FieldMapPin): L.DivIcon {
  const label = pin.label ? pin.label.replace(/[<>&]/g, '') : '';
  return L.divIcon({
    className: 'field-map-pin',
    html: `<div style="width:30px;height:30px;border-radius:50%;background:${pin.colour};border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.5);color:#fff;font:700 13px/24px system-ui,sans-serif;text-align:center">${label}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function markerIcon(m: FieldMapMarker): L.DivIcon {
  const size = m.selected ? 34 : 26;
  const ring = m.selected ? '0 0 0 4px rgba(255,255,255,.55), ' : '';
  const label = m.label.replace(/[<>&]/g, '');
  return L.divIcon({
    className: 'field-map-marker',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${m.colour};border:2px solid #fff;box-shadow:${ring}0 1px 5px rgba(0,0,0,.5);color:#fff;font:700 12px/${size - 4}px system-ui,sans-serif;text-align:center">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function ClickHandler({ onClick }: { onClick?: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onClick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function ResizeFix() {
  const map = useMap();
  useEffect(() => {
    const parent = map.getContainer().parentElement;
    if (!parent) return;
    const refresh = () => map.invalidateSize();
    const ro = new ResizeObserver(refresh);
    ro.observe(parent);
    requestAnimationFrame(refresh);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

interface FitProps {
  fitKey: string;
  points: [number, number][];
  ring: FieldMapRing | null;
  insetBottom: number;
  maxZoom: number;
}

function FitView({ fitKey, points, ring, insetBottom, maxZoom }: FitProps) {
  const map = useMap();
  useEffect(() => {
    let bounds: L.LatLngBounds | null = null;
    if (ring) {
      bounds = L.latLng(ring.lat, ring.lon).toBounds(ring.radiusM * 2);
    } else if (points.length > 0) {
      bounds = L.latLngBounds(points);
    }
    if (!bounds) return;
    const pad = 32;
    const opts = {
      paddingTopLeft: L.point(pad, pad + 56),
      paddingBottomRight: L.point(pad, pad + insetBottom),
      maxZoom,
      animate: false,
    };
    if (bounds.getSouthWest().equals(bounds.getNorthEast())) {
      map.setView(bounds.getCenter(), Math.min(maxZoom, 12), { animate: false });
    } else {
      map.fitBounds(bounds, opts);
    }
    // Only re-fit when the caller's key changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey]);
  return null;
}

/**
 * Full-size Leaflet map for the Field tools: draggable pins, numbered result markers, a radius
 * ring, a locator-square outline and an A to B line. Fills its parent (`height: 100%`).
 */
export default function FieldMap({
  pins = [],
  markers = [],
  ring = null,
  square = null,
  line = null,
  onMapClick,
  onPinDrag,
  onMarkerClick,
  fitKey,
  fitInsetBottomPx = 0,
  fitMaxZoom = 15,
}: FieldMapProps) {
  const ready = useDocumentLayoutReady();
  const { maidenheadGrid } = useMapSettings();

  const fitPoints = useMemo(() => {
    const pts: [number, number][] = pins.map((p) => [p.lat, p.lon]);
    if (square) {
      pts.push([square.south, square.west], [square.north, square.east]);
    }
    return pts;
  }, [pins, square]);

  if (!ready) return <div style={{ height: '100%' }} />;

  return (
    <MapContainer
      center={fitPoints[0] ?? DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      preferCanvas
      zoomControl={false}
      style={{ height: '100%', width: '100%' }}
    >
      <ResizeFix />
      <ClickHandler onClick={onMapClick} />
      <FitView
        fitKey={fitKey}
        points={fitPoints}
        ring={ring}
        insetBottom={fitInsetBottomPx}
        maxZoom={fitMaxZoom}
      />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MaidenheadGridLayer mode={maidenheadGrid} />
      {square ? (
        <Rectangle
          bounds={[
            [square.south, square.west],
            [square.north, square.east],
          ]}
          pathOptions={{ color: '#228be6', weight: 2, fillOpacity: 0.12 }}
          interactive={false}
        />
      ) : null}
      {ring ? (
        <Circle
          center={[ring.lat, ring.lon]}
          radius={ring.radiusM}
          pathOptions={{ color: '#4c8dff', weight: 2, dashArray: '6 6', fillOpacity: 0.05 }}
          interactive={false}
        />
      ) : null}
      {line ? (
        <Polyline
          positions={[line[0], line[1]]}
          pathOptions={{ color: '#4c8dff', weight: 3, dashArray: '8 8' }}
          interactive={false}
        />
      ) : null}
      {markers.map((m) => (
        <Marker
          key={`${m.id}:${m.selected ? 's' : 'n'}`}
          position={[m.lat, m.lon]}
          icon={markerIcon(m)}
          zIndexOffset={m.selected ? 1000 : 0}
          eventHandlers={{ click: () => onMarkerClick?.(m.id) }}
        />
      ))}
      {pins.map((p) => (
        <Marker
          key={`${p.id}:${p.label}:${p.colour}`}
          position={[p.lat, p.lon]}
          icon={pinIcon(p)}
          draggable={p.draggable}
          zIndexOffset={2000}
          eventHandlers={{
            dragend(e) {
              const { lat, lng } = (e.target as L.Marker).getLatLng();
              onPinDrag?.(p.id, lat, lng);
            },
          }}
        />
      ))}
    </MapContainer>
  );
}
