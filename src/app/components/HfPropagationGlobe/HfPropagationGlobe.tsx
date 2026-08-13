import { useEffect, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
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

export interface HardcodedShell {
  id: 'D' | 'E' | 'F1' | 'F2';
  altitudeMinKm: number;
  altitudeMaxKm: number;
  color: string;
}

// Hard-coded per background.md's altitude table — replaced by real IonosphericLayerState in #1165.
const HARDCODED_SHELLS: HardcodedShell[] = [
  { id: 'D', altitudeMinKm: 60, altitudeMaxKm: 90, color: '#4d7cff' },
  { id: 'E', altitudeMinKm: 90, altitudeMaxKm: 150, color: '#3ddc97' },
  { id: 'F1', altitudeMinKm: 150, altitudeMaxKm: 250, color: '#f5c451' },
  { id: 'F2', altitudeMinKm: 250, altitudeMaxKm: 400, color: '#ff6b6b' },
];

/**
 * Converts a shell's mid-altitude (km above the surface) to a `customThreeObject` scene-unit
 * radius — separately exported and unit-testable (no `THREE.Mesh`/`SphereGeometry`
 * instantiation needed) so #1165 can reuse this unchanged when `HARDCODED_SHELLS` is replaced
 * by a `layers: IonosphericLayerState[]` prop.
 */
export function shellRadiusUnits(midAltitudeKm: number): number {
  return (1 + altitudeKmToGlobeRadiusUnits(midAltitudeKm)) * GLOBE_RADIUS_UNITS;
}

function buildShellMesh(shell: object): THREE.Object3D {
  const s = shell as HardcodedShell;
  const midAltitudeKm = (s.altitudeMinKm + s.altitudeMaxKm) / 2;
  const radius = shellRadiusUnits(midAltitudeKm);
  const geometry = new THREE.SphereGeometry(radius, 48, 48);
  const material = new THREE.MeshBasicMaterial({
    color: s.color,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  return new THREE.Mesh(geometry, material);
}

/**
 * 3D propagation globe — renders the ionospheric shells (D/E/F1/F2) as concentric translucent
 * spheres via `react-globe.gl`'s `customThreeObject` extension point. Shells are hard-coded
 * for this rendering spike; real day/night-aware layer state lands in #1165. No ray paths or
 * transmitter marker yet (#1170).
 */
export default function HfPropagationGlobe() {
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

  return (
    <div className={classes.wrapper} ref={containerRef}>
      <Globe
        globeImageUrl={GLOBE_IMAGE_URL}
        backgroundColor={BACKGROUND_COLOR}
        showAtmosphere
        width={size.width || undefined}
        height={size.height || undefined}
        customLayerData={HARDCODED_SHELLS}
        customThreeObject={buildShellMesh}
      />
    </div>
  );
}
