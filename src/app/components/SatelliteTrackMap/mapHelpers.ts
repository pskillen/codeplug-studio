import L from 'leaflet';
import type { LatLon } from '@core/domain/geo.ts';
import classes from './SatelliteTrackMap.module.css';

/**
 * Split a track wherever consecutive samples cross the antimeridian, so a Leaflet
 * `Polyline` doesn't draw a spurious line across the whole map. Shared by
 * `SatelliteTrackMap` (ground track) and the live map (footprint circle, orbit trails).
 */
export function splitAtAntimeridian(points: LatLon[]): LatLon[][] {
  if (points.length === 0) return [];
  const segments: LatLon[][] = [[points[0]!]];
  for (let i = 1; i < points.length; i += 1) {
    const [, prevLon] = points[i - 1]!;
    const point = points[i]!;
    if (Math.abs(point[1] - prevLon) > 180) {
      segments.push([point]);
    } else {
      segments[segments.length - 1]!.push(point);
    }
  }
  return segments;
}

const DEFAULT_WORLD_COPY_OFFSETS = [-360, 0, 360] as const;

export interface WorldCopySegment {
  segment: LatLon[];
  worldOffset: number;
}

/**
 * Duplicate antimeridian-split segments at `lng ± 360°` so pass lines remain visible when
 * Leaflet's tile layer wraps and shows multiple world copies at low zoom. Apply **after**
 * `splitAtAntimeridian` — this is unrelated to the ±180° stretch fix.
 */
export function duplicateSegmentsForWorldCopies(
  segments: LatLon[][],
  worldOffsets: readonly number[] = DEFAULT_WORLD_COPY_OFFSETS,
): WorldCopySegment[] {
  const copies: WorldCopySegment[] = [];
  for (const segment of segments) {
    for (const worldOffset of worldOffsets) {
      copies.push({
        worldOffset,
        segment:
          worldOffset === 0
            ? segment
            : segment.map(([lat, lon]) => [lat, lon + worldOffset] as LatLon),
      });
    }
  }
  return copies;
}

/**
 * Observer-location marker icon. Hoisted to a module-level singleton (rather than built
 * inline in JSX on every render) — the icon is static, so there's no reason to reconstruct
 * it per render. Shared by `SatelliteTrackMap` and the live map.
 */
const OBSERVER_DIV_ICON = L.divIcon({
  className: classes.observerMarkerWrap,
  html: `<div class="${classes.observerMarker}"><div class="${classes.observerDot}"></div></div>`,
  iconAnchor: [6, 6],
});

export function observerDivIcon(): L.DivIcon {
  return OBSERVER_DIV_ICON;
}
