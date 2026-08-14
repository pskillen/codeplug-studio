import type {
  IonosphericLayerState,
  PropagationMode,
  RayPathPoint,
  RayPathResult,
  RayTraceParams,
} from './types.ts';
import { antennaGain } from './antennaPatterns.ts';
import { criticalFrequencyMhz, maximumUsableFrequencyMhz } from './mufCalculation.ts';
import { destinationPoint } from '../geoDistance.ts';

/** Typical single-hop groundwave upper bound at HF — skip-zone inner radius. */
export const GROUNDWAVE_MAX_RANGE_KM = 300;
const NVIS_MIN_TAKEOFF_DEG = 70; // per background.md's NVIS elevation-angle range (70-90°)
const ABSORBED_STRENGTH_THRESHOLD = 0.02;

/** D-layer absorption attenuation — scales relativeSignalStrength down based on frequency
 * (lower frequencies absorb more) and path length through the D layer (longer path = more
 * absorption). Simple monotonic model, not a full collision-frequency physical derivation —
 * matches this series' "idealised, teaching-tool" fidelity bar throughout. */
export function dLayerAttenuation(
  frequencyMhz: number,
  dLayerActive: boolean,
  takeoffAngleDeg: number,
): number {
  if (!dLayerActive) return 1.0; // no D layer present (night) — no absorption
  const FREQUENCY_REFERENCE_MHZ = 10; // absorption roughly halves by this frequency, per background.md §3
  const frequencyFactor = Math.min(1, frequencyMhz / FREQUENCY_REFERENCE_MHZ);
  // Longer D-layer path (lower takeoff angle = more oblique = longer path through the layer)
  // increases absorption — approximate via 1/sin(takeoff angle), clamped to avoid blow-up near 0°.
  const takeoffRad = (Math.max(takeoffAngleDeg, 2) * Math.PI) / 180;
  const pathLengthFactor = Math.min(3, 1 / Math.sin(takeoffRad));
  const attenuation = frequencyFactor / pathLengthFactor;
  return Math.max(0, Math.min(1, attenuation));
}

function applyDLayerAbsorption(
  mode: PropagationMode,
  frequencyMhz: number,
  dLayerActive: boolean,
  takeoffAngleDeg: number,
): { mode: PropagationMode; relativeSignalStrength: number } {
  if (mode !== 'skywave' && mode !== 'nvis') {
    return { mode, relativeSignalStrength: mode === 'escaped' ? 0 : 1.0 };
  }
  const relativeSignalStrength = dLayerAttenuation(frequencyMhz, dLayerActive, takeoffAngleDeg);
  if (dLayerActive && relativeSignalStrength < ABSORBED_STRENGTH_THRESHOLD) {
    return { mode: 'absorbed', relativeSignalStrength };
  }
  return { mode, relativeSignalStrength };
}

/**
 * Trace one ray at a given takeoff angle through the active ionospheric layers, classifying
 * its propagation mode and mapping path points onto the sphere from the transmitter location.
 */
export function traceRay(params: RayTraceParams, takeoffAngleDeg: number): RayPathResult {
  const activeLayers = params.layers
    .filter((l) => l.active)
    .sort((a, b) => a.altitudeMinKm - b.altitudeMinKm);
  const dLayerActive = activeLayers.some((l) => l.id === 'D');

  // Groundwave: very low takeoff angle, short range, no ionospheric interaction.
  if (takeoffAngleDeg < 5) {
    return {
      mode: 'groundwave',
      points: [
        toSpherePoint(params, 0, 0),
        toSpherePoint(params, GROUNDWAVE_MAX_RANGE_KM * 1000, 0),
      ],
      takeoffAngleDeg,
      relativeSignalStrength: 1.0,
    };
  }

  // Find the first active layer whose critical-frequency-derived MUF at this takeoff angle
  // meets or exceeds the operating frequency — that's the reflecting layer.
  for (const layer of activeLayers) {
    const fc = criticalFrequencyMhz(layer.peakElectronDensity);
    const muf = maximumUsableFrequencyMhz(fc, takeoffAngleDeg);
    if (params.frequencyMhz <= muf) {
      const classified: PropagationMode =
        takeoffAngleDeg >= NVIS_MIN_TAKEOFF_DEG ? 'nvis' : 'skywave';
      const points = buildReflectionPathPoints(params, layer, takeoffAngleDeg);
      const absorbed = applyDLayerAbsorption(
        classified,
        params.frequencyMhz,
        dLayerActive,
        takeoffAngleDeg,
      );
      return { ...absorbed, points, takeoffAngleDeg };
    }
  }

  // No active layer can reflect this frequency at this angle — the ray escapes into space.
  return {
    mode: 'escaped',
    points: buildEscapePathPoints(params, activeLayers, takeoffAngleDeg),
    takeoffAngleDeg,
    relativeSignalStrength: 0,
  };
}

function toSpherePoint(
  params: RayTraceParams,
  planeDistanceM: number,
  altitudeKm: number,
): RayPathPoint {
  const dest = destinationPoint(params.txLat, params.txLon, params.azimuthDeg, planeDistanceM);
  return { lat: dest.lat, lon: dest.lon, altitudeKm };
}

/** Simple triangular up-and-down path to the reflecting layer's mid-altitude, mapped onto the
 * sphere along `params.azimuthDeg`. Horizontal distances are the same plane geometry as before;
 * only the final conversion is now a forward geodesic. */
function buildReflectionPathPoints(
  params: RayTraceParams,
  layer: IonosphericLayerState,
  takeoffAngleDeg: number,
): RayPathPoint[] {
  const midAltitudeKm = (layer.altitudeMinKm + layer.altitudeMaxKm) / 2;
  const takeoffRad = (takeoffAngleDeg * Math.PI) / 180;
  const horizontalToApexM = (midAltitudeKm / Math.tan(takeoffRad)) * 1000;
  return [
    toSpherePoint(params, 0, 0),
    toSpherePoint(params, horizontalToApexM, midAltitudeKm),
    toSpherePoint(params, horizontalToApexM * 2, 0),
  ];
}

/** Path points for a ray that escapes — drawn continuing outward past the outermost active
 * layer rather than terminating, per the UI spec's "escaped" visual convention. */
function buildEscapePathPoints(
  params: RayTraceParams,
  activeLayers: IonosphericLayerState[],
  takeoffAngleDeg: number,
): RayPathPoint[] {
  const outermostAltitudeKm = activeLayers.length
    ? Math.max(...activeLayers.map((l) => l.altitudeMaxKm))
    : 400;
  const escapeAltitudeKm = outermostAltitudeKm * 1.3; // draw a bit past the outermost layer
  const takeoffRad = (takeoffAngleDeg * Math.PI) / 180;
  const horizontalM = (escapeAltitudeKm / Math.tan(takeoffRad)) * 1000;
  return [toSpherePoint(params, 0, 0), toSpherePoint(params, horizontalM, escapeAltitudeKm)];
}

/** Trace a fan of rays across elevation angles 0-90°, weighted by the antenna's gain at each
 * angle (rays below a power threshold are pruned — cheap early-exit per background.md §4's
 * launch-pipeline note, adapted to this phase's simpler single-plane scope). Returns only rays
 * with meaningful gain, sorted by takeoff angle ascending. */
export function traceRayFan(
  params: RayTraceParams,
  powerThreshold: number = 0.05,
): RayPathResult[] {
  const ANGLE_STEP_DEG = 2;
  const results: RayPathResult[] = [];
  for (let angle = 1; angle <= 89; angle += ANGLE_STEP_DEG) {
    const gain = antennaGain(params.antenna, angle, params.azimuthDeg, params.frequencyMhz);
    if (gain < powerThreshold) continue;
    results.push(traceRay(params, angle));
  }
  return results;
}
