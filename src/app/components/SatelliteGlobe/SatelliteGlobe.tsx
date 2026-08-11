import { useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import {
  computeGlobePointsAndFootprints,
  computeGlobeTrailPaths,
  filterGlobeSatellitesByInterest,
  type GlobeObserver,
  type GlobePath,
  type GlobePoint,
  type GlobeSatellite,
} from './buildGlobeData.ts';
import { DEFAULT_GLOBE_LOOK_AHEAD_MIN, DEFAULT_GLOBE_LOOK_BEHIND_MIN } from './orbitTrail.ts';
import { useLiveSatellitePositions } from './useLiveSatellitePositions.ts';
import { altitudeKmToGlobeRadiusUnits } from './globeAltitude.ts';
import classes from './SatelliteGlobe.module.css';

const GLOBE_IMAGE_URL = '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg';
const BACKGROUND_COLOR = '#000011';

const OBSERVER_COLOR = '#4d7cff';
/** Opaque gray for trail fade endpoints (FatLine paths do not support alpha). */
const TRAIL_FADE_GRAY = '#888888';
/** Short repeating dash for look-behind trails — whole-path ratios hide most of the path. */
const TRAIL_PAST_DASH_LENGTH = 0.02;
const TRAIL_PAST_DASH_GAP = 0.02;

export interface SatelliteGlobeProps {
  observer: GlobeObserver | null;
  satellites: GlobeSatellite[];
  /** Dashboard interest filter — only these satellites render (dots, trails, footprints). */
  interestedSatelliteIds: Set<string>;
  /** Pass-grid multi-select / globe click — highlights matching dots when non-empty. */
  highlightedSatelliteIds: Set<string>;
  /** Click a satellite dot to filter the pass grid to it (toggles off if it's the only one already selected). */
  onSelectSatellite?: (satelliteId: string) => void;
  /**
   * Live-position poll cadence, ms. Defaults to `useLiveSatellitePositions`'s own 10s default
   * (dashboard behavior, unchanged) — a single-satellite caller (e.g. the detail page) can pass
   * a faster interval to match an adjacent 2D map's cadence.
   */
  pollIntervalMs?: number;
  /** Wall-clock minutes to draw behind the mount anchor. Dashboard default 15. */
  lookBehindMin?: number;
  /** Wall-clock minutes to draw ahead of the mount anchor. Dashboard default 30. */
  lookAheadMin?: number;
}

// react-globe.gl's accessor props are typed `(obj: object) => T` (it's a generic Kapsule
// wrapper that doesn't know the row shape), so these take `object` and cast — the actual
// rows always come from `pointsData`/`pathsData` below, which this component controls.
function pointColor(point: object): string {
  const p = point as GlobePoint;
  if (p.kind === 'observer') return OBSERVER_COLOR;
  return p.color;
}

function pointRadius(point: object): number {
  const p = point as GlobePoint;
  if (p.kind === 'observer') return 0.35;
  return 0.4;
}

function pointAltitude(point: object): number {
  const p = point as GlobePoint;
  if (p.kind === 'observer') return 0;
  return altitudeKmToGlobeRadiusUnits(p.altitudeKm);
}

function pathColor(path: object): string | string[] {
  const globePath = path as GlobePath;
  if (globePath.kind === 'footprint') return globePath.color;
  if (globePath.kind === 'trail-past') return [TRAIL_FADE_GRAY, globePath.color];
  if (globePath.kind === 'trail-future') return [globePath.color, TRAIL_FADE_GRAY];
  return globePath.color;
}

function pathDashLength(path: object): number {
  return (path as GlobePath).kind === 'trail-past' ? TRAIL_PAST_DASH_LENGTH : 1;
}

function pathDashGap(path: object): number {
  return (path as GlobePath).kind === 'trail-past' ? TRAIL_PAST_DASH_GAP : 0;
}

/**
 * 3D orbital globe for the Tracking Dashboard viewport — observer marker, enabled satellites
 * as live-moving dots, ~90-minute orbit trails, and a visible-horizon footprint circle per
 * satellite. Sibling to `SatelliteLiveMap` (2D Leaflet, single-satellite detail page) rather
 * than a shared component — `react-globe.gl` handles longitude wraparound natively, so none
 * of `SatelliteTrackMap/mapHelpers.ts`'s antimeridian-splitting is needed here, and this
 * component tracks many satellites at once rather than one.
 *
 * Clicking a satellite dot calls `onSelectSatellite`, which the caller (`TrackingDashboardPage`)
 * wires to the same satellite-filter state the pass grid (`PassGrid.tsx`) reads, so a globe
 * click filters the grid to that satellite.
 */
export default function SatelliteGlobe({
  observer,
  satellites,
  interestedSatelliteIds,
  highlightedSatelliteIds,
  onSelectSatellite,
  pollIntervalMs,
  lookBehindMin = DEFAULT_GLOBE_LOOK_BEHIND_MIN,
  lookAheadMin = DEFAULT_GLOBE_LOOK_AHEAD_MIN,
}: SatelliteGlobeProps) {
  // Anchor instant for the orbit-trail window, fixed at mount so trails don't resample on
  // every live-position poll tick — same convention as SatelliteLiveMap.
  const [anchorAt] = useState(() => Date.now());

  // react-globe.gl defaults width/height to the *window's* size, not its container's — it
  // doesn't observe its own DOM node. Measure the wrapper explicitly so the globe fills the
  // fixed-height panel from SatelliteGlobe.module.css instead of overflowing it.
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    resizeObserver.observe(node);
    return () => resizeObserver.disconnect();
  }, []);

  const visibleSatellites = useMemo(
    () => filterGlobeSatellitesByInterest(satellites, interestedSatelliteIds),
    [satellites, interestedSatelliteIds],
  );

  const livePositions = useLiveSatellitePositions(visibleSatellites, pollIntervalMs);

  // Trails are SGP4-sampled at ~180 points each and don't depend on the live-position poll
  // (the window is anchored at mount) — memoized separately from `livePositions` so a poll
  // tick doesn't redo that work for every enabled satellite. See computeGlobeTrailPaths's
  // doc comment: with dozens of enabled satellites, sharing one dependency array here stalled
  // the main thread in live-browser testing.
  const trailPaths = useMemo(
    () =>
      computeGlobeTrailPaths(visibleSatellites, anchorAt, {
        lookBehindMin,
        lookAheadMin,
      }),
    [visibleSatellites, anchorAt, lookBehindMin, lookAheadMin],
  );

  const { points, footprintPaths } = useMemo(
    () =>
      computeGlobePointsAndFootprints(
        observer,
        visibleSatellites,
        livePositions,
        highlightedSatelliteIds,
      ),
    [observer, visibleSatellites, livePositions, highlightedSatelliteIds],
  );

  const paths = useMemo(() => [...trailPaths, ...footprintPaths], [trailPaths, footprintPaths]);

  const handlePointClick = (point: object) => {
    const globePoint = point as GlobePoint;
    if (globePoint.kind !== 'satellite') return;
    onSelectSatellite?.(globePoint.id);
  };

  const hasLivePositions = visibleSatellites.length === 0 || livePositions.size > 0;

  return (
    <div className={classes.wrapper} ref={containerRef}>
      <Globe
        globeImageUrl={GLOBE_IMAGE_URL}
        backgroundColor={BACKGROUND_COLOR}
        showAtmosphere
        width={size.width || undefined}
        height={size.height || undefined}
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor={pointColor}
        pointRadius={pointRadius}
        pointAltitude={pointAltitude}
        pointLabel={(point: object) => (point as GlobePoint).name}
        onPointClick={handlePointClick}
        // Zero every layer transition so live-position polls snap geometry instead of
        // morphing (points default to 1000ms — very visible now that dots sit at altitude).
        pointsTransitionDuration={0}
        pathsData={paths}
        pathPoints="points"
        pathPointLat={(p: unknown) => (p as [number, number, number])[0]}
        pathPointLng={(p: unknown) => (p as [number, number, number])[1]}
        pathPointAlt={(p: unknown) => (p as [number, number, number])[2]}
        pathColor={pathColor}
        pathDashLength={pathDashLength}
        pathDashGap={pathDashGap}
        pathDashAnimateTime={0}
        pathStroke={1}
        pathTransitionDuration={0}
        arcsTransitionDuration={0}
        labelsTransitionDuration={0}
      />
      {!hasLivePositions ? (
        <p className={classes.hint}>Acquiring live satellite positions…</p>
      ) : null}
    </div>
  );
}
