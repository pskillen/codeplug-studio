import type { LatLon } from './geo.ts';

export type FitBoundsMapViewAction = {
  type: 'fitBounds';
  southWest: LatLon;
  northEast: LatLon;
  padding: [number, number];
  maxZoom: number;
};

export type MapViewAction =
  | {
      type: 'setView';
      center: LatLon;
      zoom: number;
    }
  | FitBoundsMapViewAction;

export function collectMapPoints(
  groups: { location: { lat: number; lon: number } | null }[][],
  zonePoints: LatLon[],
  includeZones: boolean,
  extraPoints: LatLon[] = [],
): LatLon[] {
  const points: LatLon[] = [];

  for (const group of groups) {
    const ch = group[0];
    const loc = ch.location;
    if (loc != null && Number.isFinite(loc.lat) && Number.isFinite(loc.lon)) {
      points.push([loc.lat, loc.lon]);
    }
  }

  if (includeZones) {
    for (const p of zonePoints) {
      if (Number.isFinite(p[0]) && Number.isFinite(p[1])) {
        points.push(p);
      }
    }
  }

  for (const p of extraPoints) {
    if (Number.isFinite(p[0]) && Number.isFinite(p[1])) {
      points.push(p);
    }
  }

  return points;
}

/** Avoid fitBounds on zero-area bounds — Leaflet can request infinite tiles. */
export function computeMapView(
  points: LatLon[],
  options: { padding: [number, number]; maxZoom: number; singlePointZoom: number },
): MapViewAction | null {
  if (!points.length) return null;

  const lats = points.map((p) => p[0]);
  const lons = points.map((p) => p[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  if (minLat === maxLat && minLon === maxLon) {
    return {
      type: 'setView',
      center: [minLat, minLon],
      zoom: options.singlePointZoom,
    };
  }

  return {
    type: 'fitBounds',
    southWest: [minLat, minLon],
    northEast: [maxLat, maxLon],
    padding: options.padding,
    maxZoom: options.maxZoom,
  };
}

/** Vertical extent for one horizontal world repeat (excludes extreme polar caps). */
const WORLD_REPEAT_LAT_RANGE = 60;

/**
 * Fit one world repeat to the map viewport — default for satellite tracking maps before
 * a specific pass/track is selected. Centred on `centerLon` (default `0`) rather than always
 * `[-180°, 180°]`, so an observer stationed near the antimeridian isn't clipped to the very edge
 * of the shown repeat.
 */
export function computeWorldRepeatMapView(
  options: {
    padding?: [number, number];
    maxZoom?: number;
    centerLon?: number;
  } = {},
): FitBoundsMapViewAction {
  const centerLon = options.centerLon ?? 0;
  return {
    type: 'fitBounds',
    southWest: [-WORLD_REPEAT_LAT_RANGE, centerLon - 180],
    northEast: [WORLD_REPEAT_LAT_RANGE, centerLon + 180],
    padding: options.padding ?? [12, 12],
    maxZoom: options.maxZoom ?? 3,
  };
}
