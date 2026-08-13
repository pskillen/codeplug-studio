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
  fresnelEnabled: boolean;
}

/** Face-on (looking through the shell toward Earth) opacity when Fresnel shading is on. */
export const FRESNEL_OPACITY_MIN = 0.05;
/** Grazing/limb opacity when Fresnel shading is on. */
export const FRESNEL_OPACITY_MAX = 0.4;
/** `pow(1 - |N·V|, power)` — higher tightens the glow to the silhouette rim. */
export const FRESNEL_POWER = 2;

const SHELL_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SHELL_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uCameraPosition;
  uniform float uFresnelEnabled;
  uniform float uBaselineOpacity;
  uniform float uOpacityMin;
  uniform float uOpacityMax;
  uniform float uFresnelPower;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    float baseline = uBaselineOpacity;
    vec3 normal = normalize(vWorldNormal);
    // Prefer the explicit uniform (pushed from Globe.camera() each frame) and
    // fall back to Three's built-in cameraPosition if the uniform is still at origin.
    vec3 cam = uCameraPosition;
    if (dot(cam, cam) < 1e-6) {
      cam = cameraPosition;
    }
    vec3 viewDir = normalize(cam - vWorldPosition);
    float ndotv = abs(dot(normal, viewDir));
    float fresnel = pow(1.0 - clamp(ndotv, 0.0, 1.0), uFresnelPower);
    float fresnelOpacity = mix(uOpacityMin, uOpacityMax, fresnel);
    float opacity = mix(baseline, fresnelOpacity, uFresnelEnabled);
    gl_FragColor = vec4(uColor, opacity);
  }
`;

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
  const color = new THREE.Color(colorForLayer(s.id));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color },
      uCameraPosition: { value: new THREE.Vector3(0, 0, 400) },
      uFresnelEnabled: { value: display.fresnelEnabled ? 1 : 0 },
      uBaselineOpacity: { value: SHELL_BASELINE_OPACITY },
      uOpacityMin: { value: FRESNEL_OPACITY_MIN },
      uOpacityMax: { value: FRESNEL_OPACITY_MAX },
      uFresnelPower: { value: FRESNEL_POWER },
    },
    vertexShader: SHELL_VERTEX_SHADER,
    fragmentShader: SHELL_FRAGMENT_SHADER,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  return new THREE.Mesh(geometry, material);
}

/** Pushes camera position and Fresnel toggle into each shell's shader uniforms. */
export function updateShellFresnel(
  obj: THREE.Object3D,
  camera: THREE.Camera | undefined,
  fresnelEnabled: boolean,
): void {
  const mesh = obj as THREE.Mesh;
  const material = mesh.material;
  if (!(material instanceof THREE.ShaderMaterial)) return;
  material.uniforms.uFresnelEnabled.value = fresnelEnabled ? 1 : 0;
  if (camera) {
    material.uniforms.uCameraPosition.value.copy(camera.position);
  }
}
