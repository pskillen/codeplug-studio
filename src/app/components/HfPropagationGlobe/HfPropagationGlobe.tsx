import { useEffect, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { colorForLayer } from '@core/domain/hfPropagation/layerColor.ts';
import type { IonosphericLayerState } from '@core/domain/hfPropagation/types.ts';
import { altitudeKmToGlobeRadiusUnits } from '../SatelliteGlobe/globeAltitude.ts';
import classes from './HfPropagationGlobe.module.css';

const GLOBE_IMAGE_URL = '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg';
const BACKGROUND_COLOR = '#000011';

/**
 * `three-globe`'s own internal scene-unit radius for the globe mesh (verified against
 * `GLOBE_RADIUS` in `node_modules/three-globe/dist/three-globe.mjs` — not exported from the
 * package, so this is a pinned copy, not an import). `customThreeObject` positions/sizes
 * objects in these same scene units, not the `0`–`1`+ altitude units `react-globe.gl`'s own
 * `pointAltitude`/`pathPointAlt` accessors use.
 */
export const GLOBE_RADIUS_UNITS = 100;

export interface HfPropagationGlobeProps {
  layers: IonosphericLayerState[];
}

/**
 * Converts a shell's mid-altitude (km above the surface) to a `customThreeObject` scene-unit
 * radius — separately exported and unit-testable (no `THREE.Mesh`/`SphereGeometry`
 * instantiation needed).
 */
export function shellRadiusUnits(midAltitudeKm: number): number {
  return (1 + altitudeKmToGlobeRadiusUnits(midAltitudeKm)) * GLOBE_RADIUS_UNITS;
}

/**
 * Builds one translucent ionospheric shell mesh. Exported so later display-control work
 * (exaggeration / explode / Fresnel) can wrap this without duplicating geometry construction.
 * Typed as `object` because `react-globe.gl`'s `customThreeObject` callback receives layer
 * data as an untyped object.
 */
export function buildShellMesh(layer: object): THREE.Object3D {
  const s = layer as IonosphericLayerState;
  const midAltitudeKm = (s.altitudeMinKm + s.altitudeMaxKm) / 2;
  const radius = shellRadiusUnits(midAltitudeKm);
  const geometry = new THREE.SphereGeometry(radius, 48, 48);
  const material = new THREE.MeshBasicMaterial({
    color: colorForLayer(s.id),
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  return new THREE.Mesh(geometry, material);
}

/**
 * 3D propagation globe — renders active ionospheric shells (D/E/F1/F2) as concentric
 * translucent spheres via `react-globe.gl`'s `customThreeObject` extension point. No ray
 * paths or transmitter marker yet (#1170).
 */
export default function HfPropagationGlobe({ layers }: HfPropagationGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const activeLayers = layers.filter((layer) => layer.active);

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
        globeImageUrl={GLOBE_IMAGE_URL}
        backgroundColor={BACKGROUND_COLOR}
        showAtmosphere
        width={size.width || undefined}
        height={size.height || undefined}
        customLayerData={activeLayers}
        customThreeObject={buildShellMesh}
      />
    </div>
  );
}
