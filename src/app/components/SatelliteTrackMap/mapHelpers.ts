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

/**
 * Split a **closed ring** (e.g. a footprint circle, first point === last) wherever it crosses
 * the antimeridian, closing each resulting fragment against the ±180° edge instead of relying
 * on Leaflet `Polygon`'s naive last→first auto-close — which, for an open arc produced by
 * `splitAtAntimeridian`, draws a spurious chord straight across the map (the "mangled" footprint
 * circle bug). At each crossing, a synthetic boundary vertex is inserted at the interpolated
 * latitude on both sides of the seam (±180° respectively), so a fragment's own first/last points
 * always share the same antimeridian-side longitude and Leaflet's auto-close draws a short,
 * correct edge along the meridian. Because the ring is closed, the raw first and last fragments
 * (split only by the array boundary, not a real crossing) are merged back into one.
 */
export function splitRingAtAntimeridian(points: LatLon[]): LatLon[][] {
  if (points.length === 0) return [];
  const segments: LatLon[][] = [[points[0]!]];
  for (let i = 1; i < points.length; i += 1) {
    const [prevLat, prevLon] = points[i - 1]!;
    const [nextLat, nextLon] = points[i]!;
    const delta = nextLon - prevLon;
    if (Math.abs(delta) > 180) {
      const wrapsUp = delta < -180;
      const boundaryOut = wrapsUp ? 180 : -180;
      const boundaryIn = wrapsUp ? -180 : 180;
      const unwrappedNextLon = wrapsUp ? nextLon + 360 : nextLon - 360;
      const t = (boundaryOut - prevLon) / (unwrappedNextLon - prevLon);
      const crossingLat = prevLat + t * (nextLat - prevLat);
      segments[segments.length - 1]!.push([crossingLat, boundaryOut]);
      segments.push([
        [crossingLat, boundaryIn],
        [nextLat, nextLon],
      ]);
    } else {
      segments[segments.length - 1]!.push([nextLat, nextLon]);
    }
  }

  if (segments.length > 1) {
    const first = segments.shift()!;
    const last = segments.pop()!;
    segments.push([...last, ...first.slice(1)]);
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

/**
 * Live-position marker icon for a satellite's current subsatellite point, tinted per-satellite
 * via `color` (expected: `colorForNoradId(noradId, <reduced alpha>)`, matching the de-emphasised
 * hue family the dotted approach track uses). Unlike `observerDivIcon`, this isn't a module-level
 * singleton — colour varies per satellite — so callers should memoize per `noradId` (not per
 * render/poll tick) to avoid the `Marker` icon-identity churn `SatelliteLiveMap` guards against.
 */
export function liveSatelliteDivIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: classes.liveMarkerWrap,
    html: `<div class="${classes.liveMarker}" style="background:${color}"></div>`,
    iconAnchor: [5, 5],
  });
}
