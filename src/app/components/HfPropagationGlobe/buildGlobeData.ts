import * as THREE from 'three';
import { colorForLayer } from '@core/domain/hfPropagation/layerColor.ts';
import type { IonosphericLayerState } from '@core/domain/hfPropagation/types.ts';
import { altitudeKmToGlobeRadiusUnits } from '../SatelliteGlobe/globeAltitude.ts';

/**
 * `three-globe`'s own internal scene-unit radius for the globe mesh (verified against
 * `GLOBE_RADIUS` in `node_modules/three-globe/dist/three-globe.mjs` — not exported from the
 * package, so this is a pinned copy, not an import). `customThreeObject` positions/sizes
 * objects in these same scene units, not the `0`–`1`+ altitude units `react-globe.gl`'s own
 * `pointAltitude`/`pathPointAlt` accessors use.
 */
export const GLOBE_RADIUS_UNITS = 100;

/** Phase 2 baseline shell opacity; Fresnel shading modulates around this. */
export const SHELL_BASELINE_OPACITY = 0.12;

/** Extra radial separation per layer when exploded stacking is on, in globe-radius units. */
export const EXPLODE_OFFSET_PER_LAYER = 0.15;

export interface ShellDisplayOptions {
  exaggerationFactor: number;
  explodeEnabled: boolean;
}

/**
 * Exaggerates an altitude for display purposes only — physics/positioning elsewhere in the
 * app must keep using the real altitudeKm. factor 1 (or exaggeration disabled) is a no-op.
 */
export function exaggeratedAltitudeKm(altitudeKm: number, factor: number): number {
  if (!Number.isFinite(factor) || factor <= 1) return altitudeKm;
  return altitudeKm * factor;
}

/**
 * Additional radial separation (in the same globe-radius units `altitudeKmToGlobeRadiusUnits`
 * produces) for exploded-layer-stacking mode, keyed by layer index (0 = D, 1 = E, 2 = F1, 3 =
 * F2) so lower layers get less separation than higher ones and the stack still reads bottom-up.
 */
export function explodeOffsetUnits(layerIndex: number, enabled: boolean): number {
  if (!enabled) return 0;
  return layerIndex * EXPLODE_OFFSET_PER_LAYER;
}

/**
 * Scene-unit radius for a shell after display-only exaggeration and explode offset.
 * Separated from `THREE.Mesh` instantiation so the math stays unit-testable.
 */
export function displayShellRadiusUnits(
  midAltitudeKm: number,
  layerIndex: number,
  display: ShellDisplayOptions,
): number {
  const displayAltitudeKm = exaggeratedAltitudeKm(midAltitudeKm, display.exaggerationFactor);
  const index = layerIndex < 0 ? 0 : layerIndex;
  return (
    (1 +
      altitudeKmToGlobeRadiusUnits(displayAltitudeKm) +
      explodeOffsetUnits(index, display.explodeEnabled)) *
    GLOBE_RADIUS_UNITS
  );
}

/**
 * Converts a shell's mid-altitude (km above the surface) to a `customThreeObject` scene-unit
 * radius at true scale (no exaggeration, no explode).
 */
export function shellRadiusUnits(midAltitudeKm: number): number {
  return displayShellRadiusUnits(midAltitudeKm, 0, {
    exaggerationFactor: 1,
    explodeEnabled: false,
  });
}

/**
 * Builds one translucent ionospheric shell mesh. Typed as `object` because
 * `react-globe.gl`'s `customThreeObject` callback receives layer data as an untyped object.
 */
export function buildShellMesh(
  layer: object,
  layerIndex: number,
  display: ShellDisplayOptions,
): THREE.Object3D {
  const s = layer as IonosphericLayerState;
  const midAltitudeKm = (s.altitudeMinKm + s.altitudeMaxKm) / 2;
  const radius = displayShellRadiusUnits(midAltitudeKm, layerIndex, display);
  const geometry = new THREE.SphereGeometry(radius, 48, 48);
  const material = new THREE.MeshBasicMaterial({
    color: colorForLayer(s.id),
    transparent: true,
    opacity: SHELL_BASELINE_OPACITY,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  return new THREE.Mesh(geometry, material);
}
