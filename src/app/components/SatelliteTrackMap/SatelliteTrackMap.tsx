import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Fragment, useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { LatLon } from '@core/domain/geo.ts';
import { computeMapView, computeWorldRepeatMapView } from '@core/domain/mapView.ts';
import { sampleGroundTrack } from '@core/domain/satelliteTracking/groundTrack.ts';
import {
  observerDivIcon,
  liveSatelliteDivIcon,
  nearestLongitudeShift,
  unwrapLongitudes,
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

/** Alpha for the live marker and dotted approach track — de-emphasised relative to the solid
 * AOS→LOS colour, but not so low it disappears; the dark casing strokes underneath both lines
 * (below) carry the actual hue-independent contrast. */
const LIVE_POSITION_ALPHA = 0.8;

/** Neutral dark "casing" strokes drawn under the coloured lines so pale/light hues (e.g. yellow,
 * light green) stay legible against the light OSM basemap regardless of colorForNoradId's output
 * — alpha-blending a light colour onto a light background can never produce enough contrast on
 * its own. Applied to both the solid AOS→LOS line and the dashed approach line (#1094 review). */
const MAIN_CASING_COLOR = 'rgba(0, 0, 0, 0.5)';
const MAIN_CASING_WEIGHT = 4;
const APPROACH_CASING_COLOR = 'rgba(0, 0, 0, 0.45)';
const APPROACH_CASING_WEIGHT = 3.5;
const APPROACH_DASH = '5, 5';

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
 * to draw) or when the gap exceeds `MAX_APPROACH_SPAN_MS`. Raw (unsplit, unwrapped) points —
 * `buildPassTrackVisuals` below handles antimeridian continuity and world-copy placement.
 */
export function computeApproachTrack(pass: SelectedPass, nowAt: string): LatLon[] {
  const nowMs = new Date(nowAt).getTime();
  const aosMs = new Date(pass.aosAt).getTime();
  if (nowMs >= aosMs) return [];
  if (aosMs - nowMs > MAX_APPROACH_SPAN_MS) return [];

  return sampleGroundTrack(pass.tleLine1, pass.tleLine2, nowAt, pass.aosAt, GROUND_TRACK_STEP_SEC);
}

/** Raw (unsplit, unwrapped) main AOS→LOS track, extended by `drawBehindMin`/`drawAheadMin`. */
function sampleMainTrack(
  pass: SelectedPass,
  drawBehindMin: number,
  drawAheadMin: number,
): LatLon[] {
  const { fromAt, toAt } = computeTrackBounds(pass.aosAt, pass.losAt, drawBehindMin, drawAheadMin);
  return sampleGroundTrack(pass.tleLine1, pass.tleLine2, fromAt, toAt, GROUND_TRACK_STEP_SEC);
}

function passKeyFor(pass: SelectedPass): string {
  return `${pass.satelliteName}:${pass.aosAt}:${pass.losAt}`;
}

export interface PassTrackVisuals {
  mainPoints: LatLon[];
  approachPoints: LatLon[];
  markerPoint: LatLon | null;
}

/**
 * Combine a pass's main (AOS→LOS, extended) track with its below-horizon approach track (when a
 * live position exists) into **one continuous, longitude-unwrapped sequence**, then shift the
 * whole thing as a single unit so the main track's own start — "the line where the pass is over
 * the horizon for the observer" — sits closest to `referenceLon`. The live marker is simply the
 * first point of that same shifted sequence, so it is always exactly on the line it's
 * approaching, by construction — unlike the old `chooseWorldCopyOffset` approach, which snapped
 * the marker to whichever of three fixed world-copy repeats was numerically closest to the
 * (often very distant) AOS point, and which rarely lined the two up correctly (#1094 review).
 *
 * `liveRawPoint` covers the marker-only case: a live position exists but `computeApproachTrack`
 * returned no points (already at/past AOS, or the gap exceeds `MAX_APPROACH_SPAN_MS`) — the
 * marker still needs placing, reusing the same shift computed from the main track alone.
 */
export function buildPassTrackVisuals(
  mainRawPoints: LatLon[],
  approachRawPoints: LatLon[],
  liveRawPoint: LatLon | null,
  referenceLon: number,
): PassTrackVisuals {
  if (mainRawPoints.length === 0) {
    return { mainPoints: [], approachPoints: [], markerPoint: null };
  }

  const combinedRaw = [...approachRawPoints, ...mainRawPoints];
  const unwrapped = unwrapLongitudes(combinedRaw);
  const anchorLon = unwrapped[approachRawPoints.length]![1];
  const shift = nearestLongitudeShift(anchorLon, referenceLon);
  const shiftPoint = ([lat, lon]: LatLon): LatLon => [lat, lon + shift];

  const approachPoints = unwrapped.slice(0, approachRawPoints.length).map(shiftPoint);
  const mainPoints = unwrapped.slice(approachRawPoints.length).map(shiftPoint);

  let markerPoint: LatLon | null = null;
  if (approachPoints.length > 0) {
    markerPoint = approachPoints[0]!;
  } else if (liveRawPoint) {
    markerPoint = shiftPoint(liveRawPoint);
  }

  return { mainPoints, approachPoints, markerPoint };
}

function MapViewController({
  points,
  passKey,
  fitToPass,
  centerLon,
}: {
  points: LatLon[];
  /** Stable identity for the selected/default pass set — a change clears manual pan/zoom and re-fits. */
  passKey: string | null;
  /** When false, show one world repeat instead of fitting track bounds. */
  fitToPass: boolean;
  /** Centre longitude for the default (non-fit-to-pass) world-repeat view — the observer's own
   * longitude when set, so a station near the antimeridian isn't clipped to the fixed [-180,180]
   * edge. */
  centerLon: number;
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
      : computeWorldRepeatMapView({ padding: [12, 12], maxZoom: 3, centerLon });
    if (!action) return;
    if (action.type === 'setView') {
      map.setView(action.center, action.zoom);
      return;
    }
    map.fitBounds(L.latLngBounds(action.southWest, action.northEast), {
      padding: action.padding,
      maxZoom: action.maxZoom,
    });
  }, [map, points, passKey, fitToPass, centerLon]);

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

  // Raw main-track samples, keyed by pass — the expensive sampleGroundTrack calls only re-run
  // when the pass set or draw-ahead/behind sliders change, not on every live-position poll tick.
  const mainRawByKey = useMemo(() => {
    const map = new Map<string, LatLon[]>();
    for (const pass of passesToDraw) {
      map.set(passKeyFor(pass), sampleMainTrack(pass, drawBehindMin, drawAheadMin));
    }
    return map;
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

  // The observer's own longitude anchors every pass's world-copy placement (default center 0,
  // matching DEFAULT_CENTER, when no observer is set).
  const referenceLon = observer?.lon ?? DEFAULT_CENTER[1];

  const passVisuals = useMemo(() => {
    return passesToDraw.map((pass) => {
      const key = passKeyFor(pass);
      const mainRaw = mainRawByKey.get(key) ?? [];
      const live = livePositions.get(String(pass.noradId));
      const approachRaw = live ? computeApproachTrack(pass, live.at) : [];
      const visuals = buildPassTrackVisuals(
        mainRaw,
        approachRaw,
        live?.position ?? null,
        referenceLon,
      );
      return {
        key,
        color: colorForNoradId(pass.noradId),
        approachColor: colorForNoradId(pass.noradId, LIVE_POSITION_ALPHA),
        icon: liveIconsByNoradId.get(pass.noradId) ?? null,
        ...visuals,
      };
    });
  }, [passesToDraw, mainRawByKey, livePositions, referenceLon, liveIconsByNoradId]);

  const boundsPoints = useMemo(() => {
    const points: LatLon[] = [];
    for (const visual of passVisuals) {
      points.push(...visual.mainPoints);
    }
    if (observer) points.push([observer.lat, observer.lon]);
    return points;
  }, [passVisuals, observer]);

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
        {passVisuals.map((visual) => (
          <Fragment key={visual.key}>
            {visual.mainPoints.length > 1 ? (
              <>
                <Polyline
                  positions={visual.mainPoints}
                  pathOptions={{ color: MAIN_CASING_COLOR, weight: MAIN_CASING_WEIGHT }}
                />
                <Polyline
                  positions={visual.mainPoints}
                  pathOptions={{ color: visual.color, weight: 2 }}
                />
              </>
            ) : null}
            {visual.approachPoints.length > 1 ? (
              <>
                <Polyline
                  positions={visual.approachPoints}
                  pathOptions={{
                    color: APPROACH_CASING_COLOR,
                    weight: APPROACH_CASING_WEIGHT,
                    dashArray: APPROACH_DASH,
                  }}
                />
                <Polyline
                  positions={visual.approachPoints}
                  pathOptions={{ color: visual.approachColor, weight: 2, dashArray: APPROACH_DASH }}
                />
              </>
            ) : null}
            {visual.markerPoint && visual.icon ? (
              <Marker position={visual.markerPoint} icon={visual.icon} />
            ) : null}
          </Fragment>
        ))}
        <MapViewController
          points={boundsPoints}
          passKey={passKey}
          fitToPass={selectedPass !== null}
          centerLon={referenceLon}
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
