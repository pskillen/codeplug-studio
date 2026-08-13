import * as THREE from 'three';
import type { LatLon } from '@core/domain/geo.ts';
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

/** Opacity drop per canonical layer index (D=0 … F2=3) so outer shells stay slightly thinner. */
export const SHELL_OPACITY_STEP = 0.05;

export function shellBaselineOpacity(layerIndex: number): number {
  const index = layerIndex < 0 ? 0 : layerIndex;
  return Math.max(0, SHELL_INNER_BASELINE_OPACITY - index * SHELL_OPACITY_STEP);
}

/** Extra radial separation per layer when exploded stacking is on, in globe-radius units. */
export const EXPLODE_OFFSET_PER_LAYER = 0.15;

export interface ShellDisplayOptions {
  exaggerationFactor: number;
  explodeEnabled: boolean;
  fresnelEnabled: boolean;
  /** Greyline ring + night-side overlay. Default off. */
  terminatorEnabled?: boolean;
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
  const fresnelScale = baselineOpacity / SHELL_INNER_BASELINE_OPACITY;
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
    uOpacityMin: { value: FRESNEL_OPACITY_MIN * fresnelScale },
    uOpacityMax: { value: FRESNEL_OPACITY_MAX * fresnelScale },
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
  const mesh = new THREE.Mesh(geometry, material);
  // All shells share the globe origin, so Three's transparent distance-sort is unstable and
  // follows insertion order (last toggled-on shell jumps to the front). Paint outer first,
  // inner last, so D/E are not buried under F1/F2.
  mesh.renderOrder = IONOSPHERIC_LAYER_IDS.length - 1 - layerIndex;
  return mesh;
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

/** Matches `three-globe` `polar2Cartesian` (unit vector, relAltitude 0). */
export function latLonToGlobeDirection(latDeg: number, lonDeg: number): THREE.Vector3 {
  const phi = ((90 - latDeg) * Math.PI) / 180;
  const theta = ((90 - lonDeg) * Math.PI) / 180;
  const phiSin = Math.sin(phi);
  return new THREE.Vector3(phiSin * Math.cos(theta), Math.cos(phi), phiSin * Math.sin(theta));
}

/** Neutral greyline — not a shell / MODE colour. */
export const TERMINATOR_PATH_COLOR = '#cfd3dc';
/** Slight lift above the surface so the dashed ring is not z-fought with the globe mesh. */
export const TERMINATOR_PATH_ALTITUDE = 0.004;
export const NIGHT_SHADE_OPACITY = 0.15;
export const NIGHT_SHADE_RADIUS_UNITS = GLOBE_RADIUS_UNITS * 1.008;

export type TerminatorPath = {
  kind: 'terminator';
  points: [number, number, number][];
  color: string;
};

function splitLatLonRingAtAntimeridian(points: LatLon[]): LatLon[][] {
  if (points.length === 0) return [];
  const segments: LatLon[][] = [[points[0]!]];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    if (Math.abs(curr[1] - prev[1]) > 180) {
      segments.push([curr]);
    } else {
      segments[segments.length - 1]!.push(curr);
    }
  }
  return segments.filter((segment) => segment.length >= 2);
}

export function buildTerminatorPaths(ring: LatLon[]): TerminatorPath[] {
  return splitLatLonRingAtAntimeridian(ring).map((segment) => ({
    kind: 'terminator' as const,
    points: segment.map(
      ([lat, lon]) => [lat, lon, TERMINATOR_PATH_ALTITUDE] as [number, number, number],
    ),
    color: TERMINATOR_PATH_COLOR,
  }));
}

export type NightShadeLayer = {
  kind: 'night-shade';
  sunLatDeg: number;
  sunLonDeg: number;
};

export function isNightShadeLayer(d: object): d is NightShadeLayer {
  return (d as NightShadeLayer).kind === 'night-shade';
}

/**
 * Slightly oversized dark sphere; fragment alpha is 0 on the sunlit hemisphere so only the
 * night side tints the globe (~0.15). Sun direction uses three-globe cartesian, not exaggeration.
 */
export function buildNightShadeMesh(d: object): THREE.Object3D {
  const { sunLatDeg, sunLonDeg } = d as NightShadeLayer;
  const geometry = new THREE.SphereGeometry(NIGHT_SHADE_RADIUS_UNITS, 64, 64);
  const material = new THREE.MeshBasicMaterial({
    color: '#070714',
    transparent: true,
    opacity: NIGHT_SHADE_OPACITY,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  const sunDir = latLonToGlobeDirection(sunLatDeg, sunLonDeg);
  const uniforms = {
    uSunDir: { value: sunDir },
    uNightOpacity: { value: NIGHT_SHADE_OPACITY },
  };
  material.userData.nightShadeUniforms = uniforms;
  material.customProgramCacheKey = () => 'hf-night-shade';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `varying vec3 vGlobeNormal;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vGlobeNormal = normalize(transformed);`,
    );
    shader.fragmentShader = `uniform vec3 uSunDir;
uniform float uNightOpacity;
varying vec3 vGlobeNormal;
${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
         float ndotSun = dot(normalize(vGlobeNormal), normalize(uSunDir));
         float night = 1.0 - smoothstep(-0.06, 0.06, ndotSun);
         diffuseColor.a = uNightOpacity * night;`,
    );
  };
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = -1;
  return mesh;
}
