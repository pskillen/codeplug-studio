import * as THREE from 'three';
import type { LatLon } from '@core/domain/geo.ts';
import { layerMidAltitudeKm } from '@core/domain/hfPropagation/ionosphericProfile.ts';
import { colorForLayer, IONOSPHERIC_LAYER_IDS } from '@core/domain/hfPropagation/layerColor.ts';
import type {
  IonosphericLayerId,
  IonosphericLayerState,
  PropagationMode,
  RayPathResult,
} from '@core/domain/hfPropagation/types.ts';
import {
  cutawayPlaneNormal,
  latLonToGlobeCartesian,
} from '@core/domain/hfPropagation/cutawayPlane.ts';
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
  /** Greyline ring + sun marker. Default off. Night-side shade follows `environmentAtMs`. */
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

/** Matches `computeIonosphericLayers` night gate (zenith 100°) as a sun-direction cosine. */
export const DUSK_NDOT_SUN_LO = Math.cos((100 * Math.PI) / 180);
/** Day side of the dusk band — sun ~10° above the horizon. */
export const DUSK_NDOT_SUN_HI = Math.cos((80 * Math.PI) / 180);
/** D-layer is gone by the terminator and only fully present well into daylight. */
export const D_THIN_NDOT_SUN_LO = Math.cos((95 * Math.PI) / 180);
export const D_THIN_NDOT_SUN_HI = Math.cos((70 * Math.PI) / 180);

function hermiteSmoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** 0 = night hemisphere, 1 = day hemisphere (GLSL `smoothstep` equivalent). */
export function dayNightFactor(ndotSun: number): number {
  return hermiteSmoothstep(DUSK_NDOT_SUN_LO, DUSK_NDOT_SUN_HI, ndotSun);
}

/**
 * Night-side opacity scale. D/F1 vanish (F1 merges into F2 geometrically); E dims;
 * F2 stays (radius drops instead).
 */
export function shellNightPresence(id: IonosphericLayerId): number {
  if (id === 'D' || id === 'F1') return 0;
  if (id === 'E') return 0.45;
  return 1;
}

/** Extra D-layer fade so the shell thins along the terminator instead of cutting off. */
export function dLayerPresence(ndotSun: number): number {
  return hermiteSmoothstep(D_THIN_NDOT_SUN_LO, D_THIN_NDOT_SUN_HI, ndotSun);
}

export function shellPresence(id: IonosphericLayerId, ndotSun: number): number {
  if (id === 'D') return dLayerPresence(ndotSun);
  return shellNightPresence(id) + (1 - shellNightPresence(id)) * dayNightFactor(ndotSun);
}

export type ShellSunOverlay = {
  sunLatDeg: number;
  sunLonDeg: number;
};

export function isShellSunOverlay(d: object): d is IonosphericLayerState & ShellSunOverlay {
  const rec = d as IonosphericLayerState & Partial<ShellSunOverlay>;
  return (
    typeof rec.id === 'string' &&
    typeof rec.sunLatDeg === 'number' &&
    typeof rec.sunLonDeg === 'number'
  );
}

/**
 * Builds one translucent ionospheric shell mesh. Typed as `object` because
 * `react-globe.gl`'s `customThreeObject` callback receives layer data as an untyped object.
 * When sun lat/lon are present, the vertex shader mixes day/night radius (F2 drops into
 * F1's band on the night hemisphere) and the fragment shader fades D/F1 / thins D.
 */
export function buildShellMesh(
  layer: object,
  layerIndex: number,
  display: ShellDisplayOptions,
): THREE.Object3D {
  const s = layer as IonosphericLayerState;
  const spatial = isShellSunOverlay(layer) ? layer : null;
  const dayMidKm = spatial
    ? layerMidAltitudeKm(s.id, false)
    : (s.altitudeMinKm + s.altitudeMaxKm) / 2;
  const nightMidKm = spatial ? layerMidAltitudeKm(s.id, true) : dayMidKm;
  const dayRadius = displayShellRadiusUnits(dayMidKm, layerIndex, display);
  const nightRadius = displayShellRadiusUnits(nightMidKm, layerIndex, display);
  const geometry = new THREE.SphereGeometry(1, 64, 64);
  const baselineOpacity = shellBaselineOpacity(layerIndex);
  const fresnelScale = baselineOpacity / SHELL_INNER_BASELINE_OPACITY;
  const sunDir = spatial
    ? latLonToGlobeDirection(spatial.sunLatDeg, spatial.sunLonDeg)
    : new THREE.Vector3(0, 1, 0);
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
    uSunDir: { value: sunDir },
    uDayRadius: { value: dayRadius },
    uNightRadius: { value: nightRadius },
    uSpatialDayNight: { value: spatial ? 1 : 0 },
    uNightPresence: { value: shellNightPresence(s.id) },
    uDThinning: { value: s.id === 'D' ? 1 : 0 },
    uDuskLo: { value: DUSK_NDOT_SUN_LO },
    uDuskHi: { value: DUSK_NDOT_SUN_HI },
    uDThinLo: { value: D_THIN_NDOT_SUN_LO },
    uDThinHi: { value: D_THIN_NDOT_SUN_HI },
  };
  material.userData.shellFresnelUniforms = uniforms;
  material.customProgramCacheKey = () => 'hf-shell-fresnel-daynight';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `uniform vec3 uSunDir;
uniform float uDayRadius;
uniform float uNightRadius;
uniform float uSpatialDayNight;
uniform float uDuskLo;
uniform float uDuskHi;
uniform float uDThinLo;
uniform float uDThinHi;
varying vec3 vShellWorldPosition;
varying vec3 vShellWorldNormal;
varying float vDayFactor;
varying float vDPresence;
${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vec3 radial = normalize(position);
       float ndotSun = dot(radial, normalize(uSunDir));
       float dayFactor = mix(1.0, smoothstep(uDuskLo, uDuskHi, ndotSun), uSpatialDayNight);
       float dPresence = mix(1.0, smoothstep(uDThinLo, uDThinHi, ndotSun), uSpatialDayNight);
       float radius = mix(uNightRadius, uDayRadius, dayFactor);
       transformed = radial * radius;
       vDayFactor = dayFactor;
       vDPresence = dPresence;
       vShellWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
       vShellWorldNormal = normalize(mat3(modelMatrix) * radial);`,
    );
    shader.fragmentShader = `uniform float uFresnelEnabled;
uniform float uBaselineOpacity;
uniform float uOpacityMin;
uniform float uOpacityMax;
uniform float uFresnelPower;
uniform float uNightPresence;
uniform float uDThinning;
uniform float uSpatialDayNight;
varying vec3 vShellWorldPosition;
varying vec3 vShellWorldNormal;
varying float vDayFactor;
varying float vDPresence;
${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
         vec3 shellViewDir = normalize(cameraPosition - vShellWorldPosition);
         float ndotv = abs(dot(normalize(vShellWorldNormal), shellViewDir));
         float fresnel = pow(1.0 - clamp(ndotv, 0.0, 1.0), uFresnelPower);
         float fresnelOpacity = mix(uOpacityMin, uOpacityMax, fresnel);
         float baseAlpha = mix(uBaselineOpacity, fresnelOpacity, uFresnelEnabled);
         float duskPresence = mix(uNightPresence, 1.0, vDayFactor);
         float presence = mix(duskPresence, vDPresence, uDThinning);
         diffuseColor.a = baseAlpha * mix(1.0, presence, uSpatialDayNight);`,
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

/** THREE.Plane through the transmitter along `bearingDeg` (globe-centre coplanar). */
export function buildCutawayClippingPlane(
  txLat: number,
  txLon: number,
  bearingDeg: number,
): THREE.Plane {
  const n = cutawayPlaneNormal(txLat, txLon, bearingDeg);
  const normal = new THREE.Vector3(n.x, n.y, n.z);
  const coplanar = latLonToGlobeDirection(txLat, txLon).multiplyScalar(GLOBE_RADIUS_UNITS);
  return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, coplanar);
}

/**
 * Sets `clippingPlanes` on existing shell `MeshBasicMaterial`s only (Fresnel uniforms
 * discriminant). Empty array clears a previous cutaway. Does not recreate materials.
 */
export function applyShellClippingPlanes(obj: THREE.Object3D, planes: THREE.Plane[]): void {
  const mesh = obj as THREE.Mesh;
  const material = mesh.material;
  if (!(material instanceof THREE.MeshBasicMaterial)) return;
  if (!material.userData.shellFresnelUniforms) return;
  material.clippingPlanes = planes;
}

/** Matches `three-globe` `polar2Cartesian` (unit vector, relAltitude 0). */
export function latLonToGlobeDirection(latDeg: number, lonDeg: number): THREE.Vector3 {
  const { x, y, z } = latLonToGlobeCartesian(latDeg, lonDeg);
  return new THREE.Vector3(x, y, z);
}

/** Bright greyline so it reads against both the marble and the night shade. */
export const TERMINATOR_PATH_COLOR = '#fff6c8';
/** Lift above the night-shade sphere so the ring is not buried. */
export const TERMINATOR_PATH_ALTITUDE = 0.014;
export const NIGHT_SHADE_OPACITY = 0.48;
export const NIGHT_SHADE_RADIUS_UNITS = GLOBE_RADIUS_UNITS * 1.006;

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
 * night side tints the globe. Sun direction uses three-globe cartesian, not exaggeration.
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
         float night = 1.0 - smoothstep(-0.12, 0.08, ndotSun);
         diffuseColor.a = uNightOpacity * night;`,
    );
  };
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = -1;
  return mesh;
}

export type SunMarkerLayer = {
  kind: 'sun';
  sunLatDeg: number;
  sunLonDeg: number;
};

export function isSunMarkerLayer(d: object): d is SunMarkerLayer {
  return (d as SunMarkerLayer).kind === 'sun';
}

/** True-scale F2 outer radius × 3 — directional cue, not to scale. */
export const SUN_MARKER_DISTANCE_UNITS = 3 * shellRadiusUnits(400);
export const SUN_MARKER_RADIUS_UNITS = GLOBE_RADIUS_UNITS * 0.045;
export const SUN_MARKER_COLOR = '#ffe566';

/**
 * Small unlit yellow sphere along the subsolar direction, well outside the F2 shell.
 * No exaggeration, explode, or Fresnel.
 */
export function buildSunMarkerMesh(d: object): THREE.Object3D {
  const { sunLatDeg, sunLonDeg } = d as SunMarkerLayer;
  const geometry = new THREE.SphereGeometry(SUN_MARKER_RADIUS_UNITS, 24, 24);
  const material = new THREE.MeshBasicMaterial({
    color: SUN_MARKER_COLOR,
    depthWrite: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  const dir = latLonToGlobeDirection(sunLatDeg, sunLonDeg);
  mesh.position.copy(dir.multiplyScalar(SUN_MARKER_DISTANCE_UNITS));
  mesh.renderOrder = 10;
  return mesh;
}

/**
 * Propagation-mode colours for ray paths — distinct from `colorForLayer` (D/E/F1/F2 shells).
 * Phases 10 (top-down) and 11 (vertical slice) import this mapping rather than redefining it.
 */
export const MODE_COLORS: Record<PropagationMode, string> = {
  groundwave: '#4d7cff',
  skywave: '#3ddc97',
  nvis: '#f5a623',
  absorbed: '#8b3a3a',
  escaped: '#666666',
};

export const MODE_LABELS: Record<PropagationMode, string> = {
  groundwave: 'Groundwave',
  skywave: 'Skywave',
  nvis: 'NVIS',
  absorbed: 'Absorbed',
  escaped: 'Escaped',
};

export const PROPAGATION_MODES: readonly PropagationMode[] = [
  'groundwave',
  'skywave',
  'nvis',
  'absorbed',
  'escaped',
];

export interface PropagationRayGlobePath {
  kind: 'ray';
  mode: PropagationMode;
  points: [number, number, number][];
  color: string;
}

/** Neutral skip-zone / NVIS-coverage ring — not one of the five mode colours. */
export const SKIP_ZONE_PATH_COLOR = '#c8c8d4';
/** Lift slightly above the marble so the ring is not buried; below the greyline. */
export const SKIP_ZONE_PATH_ALTITUDE = 0.008;

export type SkipZoneGlobePath = {
  kind: 'skip-zone';
  points: [number, number, number][];
  color: string;
};

export type HfGlobePath = PropagationRayGlobePath | SkipZoneGlobePath | TerminatorPath;

export function rayResultsToGlobePaths(rays: RayPathResult[]): PropagationRayGlobePath[] {
  return rays.map((ray) => ({
    kind: 'ray' as const,
    mode: ray.mode,
    points: ray.points.map(
      (p) => [p.lat, p.lon, altitudeKmToGlobeRadiusUnits(p.altitudeKm)] as [number, number, number],
    ),
    color: MODE_COLORS[ray.mode],
  }));
}

export function buildSkipZonePaths(ring: LatLon[]): SkipZoneGlobePath[] {
  return splitLatLonRingAtAntimeridian(ring).map((segment) => ({
    kind: 'skip-zone' as const,
    points: segment.map(
      ([lat, lon]) => [lat, lon, SKIP_ZONE_PATH_ALTITUDE] as [number, number, number],
    ),
    color: SKIP_ZONE_PATH_COLOR,
  }));
}

/** Scene-unit tube radius — small vs globe radius 100 so the phase 9 line still reads. */
export const RAY_CORRIDOR_RADIUS_UNITS = 1.15;

export type RayCorridorLayer = {
  kind: 'ray-corridor';
  rays: RayPathResult[];
};

export function isRayCorridorLayer(d: object): d is RayCorridorLayer {
  return (d as RayCorridorLayer).kind === 'ray-corridor';
}

export function rayPointToGlobePosition(
  lat: number,
  lon: number,
  altitudeKm: number,
): THREE.Vector3 {
  const altUnits = altitudeKmToGlobeRadiusUnits(altitudeKm);
  return latLonToGlobeDirection(lat, lon).multiplyScalar(GLOBE_RADIUS_UNITS * (1 + altUnits));
}

/**
 * Optional ribbon along the same rays as `pathsData`. Thin line stays on; this mesh is additive.
 */
export function buildRayCorridorMesh(d: object): THREE.Object3D {
  const { rays } = d as RayCorridorLayer;
  const group = new THREE.Group();
  for (const ray of rays) {
    if (ray.points.length < 2) continue;
    const pts = ray.points.map((p) => rayPointToGlobePosition(p.lat, p.lon, p.altitudeKm));
    const curve = new THREE.CatmullRomCurve3(pts);
    const tubularSegments = Math.max(16, (pts.length - 1) * 8);
    const geometry = new THREE.TubeGeometry(
      curve,
      tubularSegments,
      RAY_CORRIDOR_RADIUS_UNITS,
      8,
      false,
    );
    const material = new THREE.MeshBasicMaterial({
      color: MODE_COLORS[ray.mode],
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 8;
    group.add(mesh);
  }
  return group;
}
