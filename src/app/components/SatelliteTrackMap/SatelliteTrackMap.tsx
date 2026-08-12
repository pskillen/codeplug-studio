import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { LatLon } from '@core/domain/geo.ts';
import { computeMapView, computeWorldRepeatMapView } from '@core/domain/mapView.ts';
import { sampleGroundTrack } from '@core/domain/satelliteTracking/groundTrack.ts';
import {
  observerDivIcon,
  liveSatelliteDivIcon,
  chooseWorldCopyOffset,
  duplicateSegmentsForWorldCopies,
  splitAtAntimeridian,
} from './mapHelpers.ts';
import { colorForNoradId } from '@core/domain/satelliteTracking/satelliteColor.ts';
import { useLiveSatellitePositions } from '../SatelliteGlobe/useLiveSatellitePositions.ts';
import classes from './SatelliteTrackMap.module.css';

const GROUND_TRACK_STEP_SEC = 30;
const DEFAULT_CENTER: LatLon = [20, 0];
const DEFAULT_ZOOM = 2;

/** Dotted approach track is only meaningful across a bounded below-horizon gap — beyond this,
 * "current position → next AOS" would sample most of an orbit (default passes can be up to the
 * dashboard's 168h window away) and stop reading as "the approach to this pass". Roughly two LEO
 * orbital periods; past this, the marker still shows but no dotted track is drawn. */
const MAX_APPROACH_SPAN_MS = 3 * 60 * 60 * 1000;

/** Reduced (but not too subtle — #1094 review feedback bumped this up from 0.45) alpha for the
 * live marker and dotted approach track, so both read as de-emphasised supporting context next
 * to the solid AOS→LOS colour without disappearing against typical basemap tiles. */
const LIVE_POSITION_ALPHA = 0.75;

export interface SelectedPass {
  satelliteName: string;
  noradId: number;
  tleLine1: string;
  tleLine2: string;
  aosAt: string;
  losAt: string;
}

export interface SatelliteTrackMapProps {
  observer: { lat: number; lon: number } | null;
  /** When set, draws only this pass and overrides `defaultPasses`. */
  selectedPass: SelectedPass | null;
  /** Next pass per filtered satellite when no row is selected. */
  defaultPasses?: SelectedPass[];
  /** Minutes to extend the drawn track before the pass's `aosAt`. Default 0 (strict AOS start). */
  drawBehindMin?: number;
  /** Minutes to extend the drawn track past the pass's `losAt`. Default 0 (strict LOS end). */
  drawAheadMin?: number;
}

/**
 * Compute the sampling bounds for a ground track given the pass window and the
 * operator's draw-ahead/draw-behind extension. `drawBehindMin` pushes the start
 * earlier than `aosAt`; `drawAheadMin` pushes the end later than `losAt` — both
 * relative to the pass window, not wall-clock "now".
 */
export function computeTrackBounds(
  aosAt: string,
  losAt: string,
  drawBehindMin: number,
  drawAheadMin: number,
): { fromAt: string; toAt: string } {
  const fromAt = new Date(new Date(aosAt).getTime() - drawBehindMin * 60_000).toISOString();
  const toAt = new Date(new Date(losAt).getTime() + drawAheadMin * 60_000).toISOString();
  return { fromAt, toAt };
}

/**
 * Sample the dotted below-horizon "approach" track from `nowAt` to the pass's `aosAt` — joined
 * to the AOS→LOS "interesting" segment itself, not to any `drawBehindMin`/`drawAheadMin`-extended
 * solid tail (per #1094: the dotted part should stay the below-horizon approach, not overlap the
 * extended solid track). Returns `[]` (marker-only) when `nowAt` is already at or past `aosAt`
 * (on the interesting segment, or the pass has elapsed — either way there's no forward approach
 * to draw) or when the gap exceeds `MAX_APPROACH_SPAN_MS`.
 */
export function computeApproachTrack(pass: SelectedPass, nowAt: string): LatLon[][] {
  const nowMs = new Date(nowAt).getTime();
  const aosMs = new Date(pass.aosAt).getTime();
  if (nowMs >= aosMs) return [];
  if (aosMs - nowMs > MAX_APPROACH_SPAN_MS) return [];

  const points = sampleGroundTrack(
    pass.tleLine1,
    pass.tleLine2,
    nowAt,
    pass.aosAt,
    GROUND_TRACK_STEP_SEC,
  );
  return splitAtAntimeridian(points);
}

function samplePassSegments(
  pass: SelectedPass,
  drawBehindMin: number,
  drawAheadMin: number,
): LatLon[][] {
  const { fromAt, toAt } = computeTrackBounds(pass.aosAt, pass.losAt, drawBehindMin, drawAheadMin);
  const points = sampleGroundTrack(
    pass.tleLine1,
    pass.tleLine2,
    fromAt,
    toAt,
    GROUND_TRACK_STEP_SEC,
  );
  return splitAtAntimeridian(points);
}

function MapViewController({
  points,
  passKey,
  fitToPass,
}: {
  points: LatLon[];
  /** Stable identity for the selected/default pass set — a change clears manual pan/zoom and re-fits. */
  passKey: string | null;
  /** When false, show one world repeat instead of fitting track bounds. */
  fitToPass: boolean;
}) {
  const map = useMap();
  const userInteractedRef = useRef(false);
  const lastPassKeyRef = useRef<string | null>(null);

  useMapEvents({
    dragstart: () => {
      userInteractedRef.current = true;
    },
    zoomstart: () => {
      userInteractedRef.current = true;
    },
  });

  useEffect(() => {
    if (passKey !== lastPassKeyRef.current) {
      lastPassKeyRef.current = passKey;
      userInteractedRef.current = false;
    }
  }, [passKey]);

  useEffect(() => {
    if (userInteractedRef.current) return;

    const action = fitToPass
      ? computeMapView(points, { padding: [40, 40], maxZoom: 8, singlePointZoom: 4 })
      : computeWorldRepeatMapView({ padding: [12, 12], maxZoom: 3 });
    if (!action) return;
    if (action.type === 'setView') {
      map.setView(action.center, action.zoom);
      return;
    }
    map.fitBounds(L.latLngBounds(action.southWest, action.northEast), {
      padding: action.padding,
      maxZoom: action.maxZoom,
    });
  }, [map, points, passKey, fitToPass]);

  return null;
}

/**
 * 2D ground-track preview for a selected satellite pass. New sibling to
 * `CodeplugMap` (that component is tightly coupled to Channel/Zone domain) —
 * reuses `computeMapView` for auto-fit bounds and the same `L.divIcon`
 * marker convention.
 */
export default function SatelliteTrackMap({
  observer,
  selectedPass,
  defaultPasses = [],
  drawBehindMin = 0,
  drawAheadMin = 0,
}: SatelliteTrackMapProps) {
  const passesToDraw = useMemo(
    () => (selectedPass ? [selectedPass] : defaultPasses),
    [selectedPass, defaultPasses],
  );

  const trackLayers = useMemo(() => {
    return passesToDraw.map((pass) => {
      const segments = samplePassSegments(pass, drawBehindMin, drawAheadMin);
      return {
        key: `${pass.satelliteName}:${pass.aosAt}:${pass.losAt}`,
        color: colorForNoradId(pass.noradId),
        rendered: duplicateSegmentsForWorldCopies(segments),
      };
    });
  }, [passesToDraw, drawBehindMin, drawAheadMin]);

  // Live subsatellite positions for every drawn pass, keyed by NORAD id — shared with the 3D
  // globe's multi-satellite hook rather than `useLiveSatellitePosition` (built for the single-sat
  // detail page; calling it once per array entry would violate the rules of hooks).
  const liveSatelliteInputs = useMemo(
    () =>
      passesToDraw.map((pass) => ({
        id: String(pass.noradId),
        tleLine1: pass.tleLine1,
        tleLine2: pass.tleLine2,
      })),
    [passesToDraw],
  );
  const livePositions = useLiveSatellitePositions(liveSatelliteInputs);

  // Marker icons memoized per NORAD id (not per poll tick) — matches `SatelliteLiveMap`'s
  // guard against `Marker` icon-identity churn on every live-position update.
  const liveIconsByNoradId = useMemo(() => {
    const icons = new Map<number, L.DivIcon>();
    for (const pass of passesToDraw) {
      if (icons.has(pass.noradId)) continue;
      icons.set(
        pass.noradId,
        liveSatelliteDivIcon(colorForNoradId(pass.noradId, LIVE_POSITION_ALPHA)),
      );
    }
    return icons;
  }, [passesToDraw]);

  // Longitude of each pass's own (central, unoffset) track — the reference `liveMarkers` below
  // snaps the live position's world-copy repeat to, so the marker sits next to the track it's
  // approaching instead of always rendering at its raw (`0`-offset) longitude (#1094 review
  // feedback: the dot often didn't visually "meet up with" the drawn track).
  const referenceLonByPassKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const layer of trackLayers) {
      const centralCopy = layer.rendered.find((copy) => copy.worldOffset === 0);
      const firstPoint = centralCopy?.segment[0];
      if (firstPoint) map.set(layer.key, firstPoint[1]);
    }
    return map;
  }, [trackLayers]);

  const liveMarkers = useMemo(() => {
    return passesToDraw.flatMap((pass) => {
      const live = livePositions.get(String(pass.noradId));
      const icon = liveIconsByNoradId.get(pass.noradId);
      if (!live || !icon) return [];
      const passKey = `${pass.satelliteName}:${pass.aosAt}:${pass.losAt}`;
      const referenceLon = referenceLonByPassKey.get(passKey);
      const offset =
        referenceLon === undefined ? 0 : chooseWorldCopyOffset(live.position[1], referenceLon);
      const position: LatLon =
        offset === 0 ? live.position : [live.position[0], live.position[1] + offset];
      return [
        {
          key: `${passKey}:live`,
          position,
          icon,
        },
      ];
    });
  }, [passesToDraw, livePositions, liveIconsByNoradId, referenceLonByPassKey]);

  const approachLayers = useMemo(() => {
    return passesToDraw.flatMap((pass) => {
      const live = livePositions.get(String(pass.noradId));
      if (!live) return [];
      const segments = computeApproachTrack(pass, live.at);
      if (segments.length === 0) return [];
      return [
        {
          key: `${pass.satelliteName}:${pass.aosAt}:${pass.losAt}:approach`,
          color: colorForNoradId(pass.noradId, LIVE_POSITION_ALPHA),
          rendered: duplicateSegmentsForWorldCopies(segments),
        },
      ];
    });
  }, [passesToDraw, livePositions]);

  const boundsPoints = useMemo(() => {
    const points: LatLon[] = [];
    for (const layer of trackLayers) {
      for (const copy of layer.rendered) {
        points.push(...copy.segment);
      }
    }
    if (observer) points.push([observer.lat, observer.lon]);
    return points;
  }, [trackLayers, observer]);

  const passKey = selectedPass
    ? `${selectedPass.satelliteName}:${selectedPass.aosAt}:${selectedPass.losAt}`
    : defaultPasses.length > 0
      ? defaultPasses.map((pass) => `${pass.satelliteName}:${pass.aosAt}`).join('|')
      : null;

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
        {observer ? (
          <Marker position={[observer.lat, observer.lon]} icon={observerDivIcon()} />
        ) : null}
        {trackLayers.flatMap((layer) =>
          layer.rendered.map((copy, index) => (
            <Polyline
              key={`${layer.key}:${copy.worldOffset}-${index}`}
              positions={copy.segment}
              pathOptions={{ color: layer.color, weight: 2 }}
            />
          )),
        )}
        {approachLayers.flatMap((layer) =>
          layer.rendered.map((copy, index) => (
            <Polyline
              key={`${layer.key}:${copy.worldOffset}-${index}`}
              positions={copy.segment}
              pathOptions={{ color: layer.color, weight: 1.5, dashArray: '5, 5' }}
            />
          )),
        )}
        {liveMarkers.map((marker) => (
          <Marker key={marker.key} position={marker.position} icon={marker.icon} />
        ))}
        <MapViewController
          points={boundsPoints}
          passKey={passKey}
          fitToPass={selectedPass !== null}
        />
      </MapContainer>
      {!selectedPass && defaultPasses.length === 0 ? (
        <p className={classes.hint}>
          Select satellites in the filter or a pass row below to preview a ground track.
        </p>
      ) : null}
    </div>
  );
}
