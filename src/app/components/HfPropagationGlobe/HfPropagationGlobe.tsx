import { useEffect, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import type * as THREE from 'three';
import {
  computePropagationRing,
  skipZoneOuterRadiusM,
} from '@core/domain/hfPropagation/footprint.ts';
import {
  computeSolarTerminator,
  computeSubsolarPoint,
} from '@core/domain/hfPropagation/solarTerminator.ts';
import type {
  IonosphericLayerId,
  IonosphericLayerState,
  PropagationMode,
  RayPathResult,
} from '@core/domain/hfPropagation/types.ts';
import {
  buildNightShadeMesh,
  buildRayCorridorMesh,
  buildShellMesh,
  buildSkipZonePaths,
  buildSunMarkerMesh,
  buildTerminatorPaths,
  canonicalLayerIndex,
  isNightShadeLayer,
  isRayCorridorLayer,
  isSunMarkerLayer,
  MODE_COLORS,
  MODE_LABELS,
  PROPAGATION_MODES,
  rayResultsToGlobePaths,
  applyShellClippingPlanes,
  buildCutawayClippingPlane,
  type HfGlobePath,
  type NightShadeLayer,
  type RayCorridorLayer,
  type ShellDisplayOptions,
  type SunMarkerLayer,
  updateShellFresnel,
} from './buildGlobeData.ts';
import { propagationPathDashGap, propagationPathDashLength } from './globePathDash.ts';
import classes from './HfPropagationGlobe.module.css';

export {
  buildShellMesh,
  displayShellRadiusUnits,
  GLOBE_RADIUS_UNITS,
  SHELL_BASELINE_OPACITY,
  shellRadiusUnits,
} from './buildGlobeData.ts';
export type { ShellDisplayOptions } from './buildGlobeData.ts';

const GLOBE_IMAGE_URL = '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg';
const BACKGROUND_COLOR = '#000011';
/** Matches SatelliteGlobe's observer marker. */
const TRANSMITTER_COLOR = '#4d7cff';
const DEFAULT_TX_LAT_DEG = 0;
const DEFAULT_TX_LON_DEG = 0;

export type LayerVisibility = Record<IonosphericLayerId, boolean>;

export const DEFAULT_LAYER_VISIBILITY: LayerVisibility = {
  D: true,
  E: true,
  F1: true,
  F2: true,
};

export interface HfPropagationGlobeProps {
  layers: IonosphericLayerState[];
  display?: ShellDisplayOptions;
  /** Operator on/off per layer. Defaults all on. Physics `active` still gates whether a shell exists. */
  visibleLayers?: LayerVisibility;
  /** Instant used for the greyline / night-side overlay (Environment datetime). */
  environmentAtMs?: number;
  /** Traced rays for the primary azimuth — `pathsData` lines colour/dash by `PropagationMode`. */
  rays?: RayPathResult[];
  /** Transmitter WGS84 latitude (degrees). Defaults to 0° until the page sets a site. */
  txLat?: number;
  /** Transmitter WGS84 longitude (degrees). Defaults to 0° until the page sets a site. */
  txLon?: number;
  /** Clip shells along the slice-plane bearing. Default off. */
  cutawayEnabled?: boolean;
  /**
   * Slice-plane bearing (degrees true) — same `SlicePlaneResult.bearingDeg` as the vertical
   * slice. Antenna heading when the picker has not been used.
   */
  sliceBearingDeg?: number;
  /** TubeGeometry ribbon along the traced rays. Default off; thin `pathsData` line stays on. */
  rayCorridorEnabled?: boolean;
}

const DEFAULT_DISPLAY: ShellDisplayOptions = {
  exaggerationFactor: 1,
  explodeEnabled: false,
  fresnelEnabled: false,
};

function pathColor(path: object): string {
  return (path as HfGlobePath).color;
}

function pathDashLength(path: object): number {
  return propagationPathDashLength(path as HfGlobePath);
}

function pathDashGap(path: object): number {
  return propagationPathDashGap(path as HfGlobePath);
}

function pathStroke(path: object): number {
  const kind = (path as HfGlobePath).kind;
  if (kind === 'terminator') return 3.6;
  if (kind === 'skip-zone') return 1.6;
  return 1.8;
}

function legendStrokeStyle(mode: PropagationMode): 'solid' | 'dashed' | 'dotted' {
  if (mode === 'groundwave') return 'solid';
  if (mode === 'absorbed' || mode === 'escaped') return 'dotted';
  return 'dashed';
}

function PropagationModeLegend() {
  return (
    <ul className={classes.legend} aria-label="Propagation modes">
      {PROPAGATION_MODES.map((mode) => (
        <li key={mode} className={classes.legendItem}>
          <span
            className={classes.legendSample}
            style={{
              borderTopColor: MODE_COLORS[mode],
              borderTopStyle: legendStrokeStyle(mode),
            }}
            aria-hidden
          />
          {MODE_LABELS[mode]}
        </li>
      ))}
    </ul>
  );
}

/**
 * 3D propagation globe — ionospheric shells via `customThreeObject`, plus traced ray paths
 * (`pathsData`), skip-zone ring, and a transmitter marker (`pointsData`). With
 * `environmentAtMs`, shells vary by sun hemisphere (D/F1 fade at night, F2 drops into F1's
 * band) and the night side is shaded. Optional solar terminator ring and sun marker.
 */
export default function HfPropagationGlobe({
  layers,
  display = DEFAULT_DISPLAY,
  visibleLayers = DEFAULT_LAYER_VISIBILITY,
  environmentAtMs,
  rays = [],
  txLat = DEFAULT_TX_LAT_DEG,
  txLon = DEFAULT_TX_LON_DEG,
  cutawayEnabled = false,
  sliceBearingDeg = 0,
  rayCorridorEnabled = false,
}: HfPropagationGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const fresnelEnabledRef = useRef(display.fresnelEnabled);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const visibleShells = useMemo(
    () =>
      layers
        .filter((layer) => {
          if (visibleLayers[layer.id] === false) return false;
          // Spatial day/night draws all four shells; the shader fades D/F1 on the night
          // hemisphere. Without an environment instant, keep TX-local physics `active`.
          if (environmentAtMs != null) return true;
          return layer.active;
        })
        .slice()
        .sort((a, b) => canonicalLayerIndex(a.id) - canonicalLayerIndex(b.id)),
    [layers, visibleLayers, environmentAtMs],
  );
  const { exaggerationFactor, explodeEnabled, fresnelEnabled, terminatorEnabled } = display;

  const cutawayPlanes = useMemo(
    () => (cutawayEnabled ? [buildCutawayClippingPlane(txLat, txLon, sliceBearingDeg)] : []),
    [cutawayEnabled, txLat, txLon, sliceBearingDeg],
  );
  const cutawayPlanesRef = useRef(cutawayPlanes);
  useEffect(() => {
    cutawayPlanesRef.current = cutawayPlanes;
  }, [cutawayPlanes]);

  const subsolar = useMemo(() => {
    if (environmentAtMs == null) return null;
    const [sunLatDeg, sunLonDeg] = computeSubsolarPoint(environmentAtMs);
    return { sunLatDeg, sunLonDeg };
  }, [environmentAtMs]);

  const terminatorPaths = useMemo(() => {
    if (!terminatorEnabled || environmentAtMs == null) return [];
    return buildTerminatorPaths(computeSolarTerminator(environmentAtMs));
  }, [terminatorEnabled, environmentAtMs]);

  const rayPaths = useMemo(() => rayResultsToGlobePaths(rays), [rays]);
  const skipZonePaths = useMemo(() => {
    const outerM = skipZoneOuterRadiusM(rays, txLat, txLon);
    if (outerM == null) return [];
    return buildSkipZonePaths(computePropagationRing(txLat, txLon, outerM));
  }, [rays, txLat, txLon]);
  const paths = useMemo(
    () => [...rayPaths, ...skipZonePaths, ...terminatorPaths],
    [rayPaths, skipZonePaths, terminatorPaths],
  );
  const points = useMemo(
    () => [
      {
        kind: 'transmitter' as const,
        lat: txLat,
        lng: txLon,
        color: TRANSMITTER_COLOR,
      },
    ],
    [txLat, txLon],
  );

  const customLayerData = useMemo(() => {
    const objects: Array<
      IonosphericLayerState | NightShadeLayer | SunMarkerLayer | RayCorridorLayer
    > = visibleShells.map((layer) =>
      subsolar ? { ...layer, sunLatDeg: subsolar.sunLatDeg, sunLonDeg: subsolar.sunLonDeg } : layer,
    );
    if (subsolar) {
      objects.push({
        kind: 'night-shade',
        sunLatDeg: subsolar.sunLatDeg,
        sunLonDeg: subsolar.sunLonDeg,
      });
      if (terminatorEnabled) {
        objects.push({
          kind: 'sun',
          sunLatDeg: subsolar.sunLatDeg,
          sunLonDeg: subsolar.sunLonDeg,
        });
      }
    }
    if (rayCorridorEnabled && rays.length > 0) {
      objects.push({ kind: 'ray-corridor', rays });
    }
    return objects;
  }, [visibleShells, subsolar, terminatorEnabled, rayCorridorEnabled, rays]);

  useEffect(() => {
    fresnelEnabledRef.current = fresnelEnabled;
  }, [fresnelEnabled]);

  const shellObjectAccessor = useMemo(
    () => (d: object) => {
      if (isNightShadeLayer(d)) return buildNightShadeMesh(d);
      if (isSunMarkerLayer(d)) return buildSunMarkerMesh(d);
      if (isRayCorridorLayer(d)) return buildRayCorridorMesh(d);
      const layer = d as IonosphericLayerState;
      const mesh = buildShellMesh(d, canonicalLayerIndex(layer.id), {
        exaggerationFactor,
        explodeEnabled,
        fresnelEnabled,
      });
      applyShellClippingPlanes(mesh, cutawayPlanesRef.current);
      return mesh;
    },
    [exaggerationFactor, explodeEnabled, fresnelEnabled],
  );

  // Verified against react-globe.gl 2.x: customThreeObjectUpdate runs when custom-layer
  // *data* changes (once per object on create/update), not once per animation frame.
  // Fresnel still needs a live camera position, so a rAF loop pushes Globe.camera()
  // into each shell shader; this accessor keeps the documented hook wired for data updates.
  const fresnelUpdateAccessor = useMemo(
    () => (obj: THREE.Object3D) => {
      const camera = globeRef.current?.camera() as THREE.Camera | undefined;
      updateShellFresnel(obj, camera, fresnelEnabledRef.current);
    },
    [],
  );

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const globe = globeRef.current;
      const camera = globe?.camera() as THREE.Camera | undefined;
      const scene = globe?.scene();
      if (camera && scene) {
        const renderer = globe?.renderer();
        if (renderer) renderer.localClippingEnabled = true;
        scene.traverse((obj) => {
          updateShellFresnel(obj, camera, fresnelEnabledRef.current);
          applyShellClippingPlanes(obj, cutawayPlanesRef.current);
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    const renderer = globe?.renderer();
    if (renderer) renderer.localClippingEnabled = true;
    const scene = globe?.scene();
    if (!scene) return;
    scene.traverse((obj) => applyShellClippingPlanes(obj, cutawayPlanes));
  }, [cutawayPlanes, size.width, size.height, customLayerData]);

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

  return (
    <div className={classes.wrapper} ref={containerRef}>
      <Globe
        ref={globeRef}
        globeImageUrl={GLOBE_IMAGE_URL}
        backgroundColor={BACKGROUND_COLOR}
        showAtmosphere
        width={size.width || undefined}
        height={size.height || undefined}
        customLayerData={customLayerData}
        customThreeObject={shellObjectAccessor}
        customThreeObjectUpdate={fresnelUpdateAccessor}
        pathsData={paths}
        pathPoints="points"
        pathPointLat={(p: unknown) => (p as [number, number, number])[0]}
        pathPointLng={(p: unknown) => (p as [number, number, number])[1]}
        pathPointAlt={(p: unknown) => (p as [number, number, number])[2]}
        pathColor={pathColor}
        pathDashLength={pathDashLength}
        pathDashGap={pathDashGap}
        pathDashAnimateTime={0}
        pathStroke={pathStroke}
        pathTransitionDuration={0}
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor={() => TRANSMITTER_COLOR}
        pointRadius={0.35}
        pointAltitude={0}
        pointsTransitionDuration={0}
      />
      <PropagationModeLegend />
    </div>
  );
}
