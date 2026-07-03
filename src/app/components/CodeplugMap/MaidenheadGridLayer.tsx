import type { GridPrecision } from '@core/domain/maidenheadGrid.ts';
import {
  computeGridLabels,
  computeGridLines,
  type MaidenheadGridMode,
} from '@core/domain/maidenheadGrid.ts';
import L from 'leaflet';
import { useMemo, useState } from 'react';
import { Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';

const MIN_LABEL_CELL_WIDTH_PX = 48;

const LON_STEP_BY_LEVEL: Record<GridPrecision, number> = {
  4: 2,
  6: 2 / 24,
  8: 2 / 240,
};

const LINE_STYLE: Record<
  GridPrecision,
  { color: string; weight: number; opacity: number; dashArray?: string }
> = {
  4: { color: '#495057', weight: 1.25, opacity: 0.55 },
  6: { color: '#868e96', weight: 1, opacity: 0.38, dashArray: '8, 6' },
  8: { color: '#adb5bd', weight: 0.75, opacity: 0.28, dashArray: '2, 5' },
};

function boundsFromLeaflet(bounds: L.LatLngBounds) {
  return {
    south: bounds.getSouth(),
    west: bounds.getWest(),
    north: bounds.getNorth(),
    east: bounds.getEast(),
  };
}

function safeMapBounds(map: L.Map) {
  if (typeof map.getBounds === 'function') {
    return boundsFromLeaflet(map.getBounds());
  }
  return { south: 49, west: -11, north: 61, east: 2 };
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Rough screen width of a grid cell — skip labels when cells are too small to read. */
export function estimatedCellWidthPx(zoom: number, lat: number, level: GridPrecision): number {
  const lonStep = LON_STEP_BY_LEVEL[level];
  const pixelsPerDegree = (256 * 2 ** zoom) / 360;
  return lonStep * pixelsPerDegree * Math.cos((lat * Math.PI) / 180);
}

export function shouldShowLabel(zoom: number, level: GridPrecision, lat: number): boolean {
  return estimatedCellWidthPx(zoom, lat, level) >= MIN_LABEL_CELL_WIDTH_PX;
}

function labelIcon(text: string): L.DivIcon {
  return L.divIcon({
    className: 'maidenhead-grid-label-wrap',
    html: `<span class="maidenhead-grid-label">${escapeHtml(text)}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export interface MaidenheadGridLayerProps {
  mode: MaidenheadGridMode;
}

export default function MaidenheadGridLayer({ mode }: MaidenheadGridLayerProps) {
  const map = useMap();
  const [bounds, setBounds] = useState(() => safeMapBounds(map));
  const [zoom, setZoom] = useState(() => map.getZoom?.() ?? 6);

  const syncView = () => {
    setBounds(safeMapBounds(map));
    if (typeof map.getZoom === 'function') setZoom(map.getZoom());
  };

  useMapEvents({
    moveend: syncView,
    zoomend: syncView,
  });

  const lines = useMemo(
    () => (mode === 'off' ? [] : computeGridLines(bounds, mode, undefined, zoom)),
    [bounds, mode, zoom],
  );

  const labels = useMemo(() => {
    if (mode === 'off') return [];
    return computeGridLabels(bounds, mode, undefined, zoom).filter((label) =>
      shouldShowLabel(zoom, label.level, label.position[0]),
    );
  }, [bounds, mode, zoom]);

  if (mode === 'off') return null;

  return (
    <>
      {lines.map((line, index) => {
        const style = LINE_STYLE[line.level];
        return (
          <Polyline
            key={`${line.level}-${index}-${line.positions[0][0]}-${line.positions[0][1]}`}
            positions={line.positions}
            pathOptions={{
              color: style.color,
              weight: style.weight,
              opacity: style.opacity,
              ...(style.dashArray ? { dashArray: style.dashArray } : {}),
            }}
            interactive={false}
          />
        );
      })}
      {labels.map((label) => (
        <Marker
          key={`${label.level}-${label.text}-${label.position[0]}-${label.position[1]}`}
          position={label.position}
          icon={labelIcon(label.text)}
          interactive={false}
        />
      ))}
    </>
  );
}
