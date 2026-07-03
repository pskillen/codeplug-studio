import L from 'leaflet';
import { Anchor, Group } from '@mantine/core';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import MaidenheadGridLayer from '../CodeplugMap/MaidenheadGridLayer.tsx';
import '../CodeplugMap/CodeplugMap.css';
import { useDocumentLayoutReady } from '../../hooks/useDocumentLayoutReady.ts';
import { useMapSettings } from '../../hooks/useMapSettings.ts';
import { SETTINGS_MAP_SECTION_ID } from '../../lib/settingsSections.ts';

const DEFAULT_CENTER: [number, number] = [56.5, -4.0];
const DEFAULT_ZOOM = 6;

function pickIcon(): L.DivIcon {
  return L.divIcon({
    className: 'map-location-picker-marker',
    html: '<div style="width:16px;height:16px;border-radius:50%;background:#228be6;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
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

function MapViewSync({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView([lat, lon], Math.max(map.getZoom(), 10));
  }, [map, lat, lon]);

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

export interface MapLocationPickerProps {
  lat: number | null;
  lon: number | null;
  onPick: (lat: number, lon: number) => void;
  height?: number | string;
}

export default function MapLocationPicker({
  lat,
  lon,
  onPick,
  height = 280,
}: MapLocationPickerProps) {
  const mapLayoutReady = useDocumentLayoutReady();
  const { maidenheadGrid } = useMapSettings();
  const hasPosition = lat != null && lon != null;
  const center: [number, number] = hasPosition ? [lat, lon] : DEFAULT_CENTER;
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
        {mapLayoutReady ? (
          <MapContainer
            center={center}
            zoom={hasPosition ? 11 : DEFAULT_ZOOM}
            preferCanvas
            style={{ height: '100%', width: '100%' }}
          >
            <MapResizeFix />
            <MapClickHandler onPick={onPick} />
            {hasPosition ? <MapViewSync lat={lat} lon={lon} /> : null}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MaidenheadGridLayer mode={maidenheadGrid} />
            {hasPosition ? (
              <Marker
                position={[lat, lon]}
                icon={pickIcon()}
                draggable
                eventHandlers={{
                  dragend(e) {
                    const { lat: markerLat, lng } = e.target.getLatLng();
                    onPick(markerLat, lng);
                  },
                }}
              />
            ) : null}
          </MapContainer>
        ) : null}
      </div>
    </div>
  );
}
