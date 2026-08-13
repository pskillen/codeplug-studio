import { useEffect, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import type * as THREE from 'three';
import { computeSolarTerminator, computeSubsolarPoint } from '@core/domain/hfPropagation/solarTerminator.ts';
import type {
  IonosphericLayerId,
  IonosphericLayerState,
} from '@core/domain/hfPropagation/types.ts';
import {
  buildNightShadeMesh,
  buildShellMesh,
  buildTerminatorPaths,
  canonicalLayerIndex,
  isNightShadeLayer,
  type NightShadeLayer,
  type ShellDisplayOptions,
  updateShellFresnel,
} from './buildGlobeData.ts';
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
}

const DEFAULT_DISPLAY: ShellDisplayOptions = {
  exaggerationFactor: 1,
  explodeEnabled: false,
  fresnelEnabled: false,
};

/**
 * 3D propagation globe — renders active ionospheric shells (D/E/F1/F2) as concentric
 * translucent spheres via `react-globe.gl`'s `customThreeObject` extension point. Optional
 * solar terminator ring (`pathsData`) and night-side shade. No ray paths or transmitter
 * marker yet (#1170).
 */
export default function HfPropagationGlobe({
  layers,
  display = DEFAULT_DISPLAY,
  visibleLayers = DEFAULT_LAYER_VISIBILITY,
  environmentAtMs,
}: HfPropagationGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const fresnelEnabledRef = useRef(display.fresnelEnabled);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const visibleShells = useMemo(
    () =>
      layers
        .filter((layer) => layer.active && visibleLayers[layer.id] !== false)
        .slice()
        .sort((a, b) => canonicalLayerIndex(a.id) - canonicalLayerIndex(b.id)),
    [layers, visibleLayers],
  );
  const { exaggerationFactor, explodeEnabled, fresnelEnabled, terminatorEnabled } = display;

  const terminatorPaths = useMemo(() => {
    if (!terminatorEnabled || environmentAtMs == null) return [];
    return buildTerminatorPaths(computeSolarTerminator(environmentAtMs));
  }, [terminatorEnabled, environmentAtMs]);

  const customLayerData = useMemo(() => {
    const objects: Array<IonosphericLayerState | NightShadeLayer> = [...visibleShells];
    if (terminatorEnabled && environmentAtMs != null) {
      const [sunLatDeg, sunLonDeg] = computeSubsolarPoint(environmentAtMs);
      objects.push({ kind: 'night-shade', sunLatDeg, sunLonDeg });
    }
    return objects;
  }, [visibleShells, terminatorEnabled, environmentAtMs]);

  useEffect(() => {
    fresnelEnabledRef.current = fresnelEnabled;
  }, [fresnelEnabled]);

  const shellObjectAccessor = useMemo(
    () => (d: object) => {
      if (isNightShadeLayer(d)) return buildNightShadeMesh(d);
      const layer = d as IonosphericLayerState;
      return buildShellMesh(d, canonicalLayerIndex(layer.id), {
        exaggerationFactor,
        explodeEnabled,
        fresnelEnabled,
      });
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
        scene.traverse((obj) => {
          updateShellFresnel(obj, camera, fresnelEnabledRef.current);
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

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
        pathsData={terminatorPaths}
        pathPoints="points"
        pathPointLat={(p: unknown) => (p as [number, number, number])[0]}
        pathPointLng={(p: unknown) => (p as [number, number, number])[1]}
        pathPointAlt={(p: unknown) => (p as [number, number, number])[2]}
        pathColor={(path: object) => (path as { color: string }).color}
        pathDashLength={0.12}
        pathDashGap={0.08}
        pathDashAnimateTime={0}
        pathStroke={1.2}
        pathTransitionDuration={0}
      />
    </div>
  );
}
