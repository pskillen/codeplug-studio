import * as THREE from 'three';
import { colorForLayer, IONOSPHERIC_LAYER_IDS } from '@core/domain/hfPropagation/layerColor.ts';
import type {
  IonosphericLayerId,
  IonosphericLayerState,
} from '@core/domain/hfPropagation/types.ts';
import { altitudeKmToGlobeRadiusUnits } from '../SatelliteGlobe/globeAltitude.ts';

/**
 * `three-globe`'s own internal scene-unit radius for the globe mesh (verified against
 * `GLOBE_RADIUS` in `node_modules/three-globe/dist/three-globe.mjs` — not exported from the
 * package, so this is a pinned copy, not an import). `customThreeObject` positions/sizes
 * objects in these same scene units, not the `0`–`1`+ altitude units `react-globe.gl`'s own
 * `pointAltitude`/`pathPointAlt` accessors use.
 */
export const GLOBE_RADIUS_UNITS = 100;

/** Phase 2 baseline shell opacity for F1/F2; Fresnel shading modulates around this. */
export const SHELL_BASELINE_OPACITY = 0.12;

/** D/E sit only a few percent above the globe mesh — bump so they remain readable when isolated. */
export const SHELL_INNER_BASELINE_OPACITY = 0.28;

/** Canonical D=0 … F2=3 index for explode offsets, independent of which shells are currently drawn. */
export function canonicalLayerIndex(id: IonosphericLayerId): number {
  const index = IONOSPHERIC_LAYER_IDS.indexOf(id);
  return index < 0 ? 0 : index;
}

export function shellBaselineOpacity(layerIndex: number): number {
  return layerIndex <= 1 ? SHELL_INNER_BASELINE_OPACITY : SHELL_BASELINE_OPACITY;
}

/** Extra radial separation per layer when exploded stacking is on, in globe-radius units. */
export const EXPLODE_OFFSET_PER_LAYER = 0.15;

export interface ShellDisplayOptions {
  exaggerationFactor: number;
  explodeEnabled: boolean;
  fresnelEnabled: boolean;
}

/** Face-on (looking through the shell toward Earth) opacity when Fresnel shading is on. */
export const FRESNEL_OPACITY_MIN = 0.05;
/** Grazing/limb opacity when Fresnel shading is on. */
export const FRESNEL_OPACITY_MAX = 0.4;
/** `pow(1 - |N·V|, power)` — higher tightens the glow to the silhouette rim. */
export const FRESNEL_POWER = 2;

/**
 * Per-fragment Fresnel opacity for a given |N·V| (1 = face-on, 0 = grazing).
 * Matches the fragment shader: `mix(MIN, MAX, pow(1 - |N·V|, POWER))`.
 */
export function fresnelOpacity(ndotv: number): number {
  const clamped = Math.min(1, Math.max(0, Math.abs(ndotv)));
  const fresnel = (1 - clamped) ** FRESNEL_POWER;
  return FRESNEL_OPACITY_MIN + fresnel * (FRESNEL_OPACITY_MAX - FRESNEL_OPACITY_MIN);
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
    fresnelEnabled: false,
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
  const baselineOpacity = shellBaselineOpacity(layerIndex);
  const material = new THREE.MeshBasicMaterial({
    color: colorForLayer(s.id),
    transparent: true,
    opacity: baselineOpacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const uniforms = {
    uFresnelEnabled: { value: display.fresnelEnabled ? 1 : 0 },
    uBaselineOpacity: { value: baselineOpacity },
    uOpacityMin: { value: FRESNEL_OPACITY_MIN },
    uOpacityMax: { value: FRESNEL_OPACITY_MAX },
    uFresnelPower: { value: FRESNEL_POWER },
  };
  material.userData.shellFresnelUniforms = uniforms;
  material.customProgramCacheKey = () => 'hf-shell-fresnel';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader =
      `varying vec3 vShellWorldPosition;\nvarying vec3 vShellWorldNormal;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
       vShellWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
       vShellWorldNormal = normalize(mat3(modelMatrix) * position);`,
      );
    shader.fragmentShader = `uniform float uFresnelEnabled;
uniform float uBaselineOpacity;
uniform float uOpacityMin;
uniform float uOpacityMax;
uniform float uFresnelPower;
varying vec3 vShellWorldPosition;
varying vec3 vShellWorldNormal;
${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
         vec3 shellViewDir = normalize(cameraPosition - vShellWorldPosition);
         float ndotv = abs(dot(normalize(vShellWorldNormal), shellViewDir));
         float fresnel = pow(1.0 - clamp(ndotv, 0.0, 1.0), uFresnelPower);
         float fresnelOpacity = mix(uOpacityMin, uOpacityMax, fresnel);
         diffuseColor.a = mix(uBaselineOpacity, fresnelOpacity, uFresnelEnabled);`,
    );
  };
  return new THREE.Mesh(geometry, material);
}

/** Pushes the Fresnel toggle into each shell's shader uniforms. */
export function updateShellFresnel(
  obj: THREE.Object3D,
  _camera: THREE.Camera | undefined,
  fresnelEnabled: boolean,
): void {
  const mesh = obj as THREE.Mesh;
  const material = mesh.material;
  if (!(material instanceof THREE.MeshBasicMaterial)) return;
  const uniforms = material.userData.shellFresnelUniforms as
    { uFresnelEnabled: { value: number } } | undefined;
  if (!uniforms) return;
  uniforms.uFresnelEnabled.value = fresnelEnabled ? 1 : 0;
}
