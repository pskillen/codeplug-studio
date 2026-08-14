import type {
  IonosphericLayerState,
  PropagationMode,
  RayPathPoint,
  RayPathResult,
  RayTraceParams,
} from './types.ts';
import { criticalFrequencyMhz, maximumUsableFrequencyMhz } from './mufCalculation.ts';

const GROUNDWAVE_MAX_RANGE_KM = 300; // typical single-hop groundwave upper bound at HF
const NVIS_MIN_TAKEOFF_DEG = 70; // per background.md's NVIS elevation-angle range (70-90°)

/**
 * Trace one ray at a given takeoff angle through the active ionospheric layers, in a single
 * vertical plane (2D: plane-distance vs. altitude), classifying its propagation mode.
 * Does NOT apply D-layer absorption weighting (phase 7) or map onto the sphere (phase 7) —
 * relativeSignalStrength is always 1.0 here (0 for escaped), points are 2D plane coordinates.
 */
export function traceRay(params: RayTraceParams, takeoffAngleDeg: number): RayPathResult {
  const activeLayers = params.layers
    .filter((l) => l.active)
    .sort((a, b) => a.altitudeMinKm - b.altitudeMinKm);

  // Groundwave: very low takeoff angle, short range, no ionospheric interaction.
  if (takeoffAngleDeg < 5) {
    return {
      mode: 'groundwave',
      points: [
        { planeDistanceM: 0, altitudeKm: 0 },
        { planeDistanceM: GROUNDWAVE_MAX_RANGE_KM * 1000, altitudeKm: 0 },
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
      const mode: PropagationMode = takeoffAngleDeg >= NVIS_MIN_TAKEOFF_DEG ? 'nvis' : 'skywave';
      const points = buildReflectionPathPoints(layer, takeoffAngleDeg);
      return { mode, points, takeoffAngleDeg, relativeSignalStrength: 1.0 };
    }
  }

  // No active layer can reflect this frequency at this angle — the ray escapes into space.
  return {
    mode: 'escaped',
    points: buildEscapePathPoints(activeLayers, takeoffAngleDeg),
    takeoffAngleDeg,
    relativeSignalStrength: 0,
  };
}

/** Simple triangular up-and-down path to the reflecting layer's mid-altitude, in plane
 * coordinates. A geometrically simplified single-hop path — not a curved refraction trace
 * (that level of fidelity is not required for correct mode classification, which is this
 * phase's job; a smoother curve is a plausible future visual-polish refinement, not required
 * for #1170's rendering to look reasonable at this altitude/distance scale). */
function buildReflectionPathPoints(
  layer: IonosphericLayerState,
  takeoffAngleDeg: number,
): RayPathPoint[] {
  const midAltitudeKm = (layer.altitudeMinKm + layer.altitudeMaxKm) / 2;
  const takeoffRad = (takeoffAngleDeg * Math.PI) / 180;
  const horizontalToApexM = (midAltitudeKm / Math.tan(takeoffRad)) * 1000;
  return [
    { planeDistanceM: 0, altitudeKm: 0 },
    { planeDistanceM: horizontalToApexM, altitudeKm: midAltitudeKm },
    { planeDistanceM: horizontalToApexM * 2, altitudeKm: 0 },
  ];
}

/** Path points for a ray that escapes — drawn continuing outward past the outermost active
 * layer rather than terminating, per the UI spec's "escaped" visual convention. */
function buildEscapePathPoints(
  activeLayers: IonosphericLayerState[],
  takeoffAngleDeg: number,
): RayPathPoint[] {
  const outermostAltitudeKm = activeLayers.length
    ? Math.max(...activeLayers.map((l) => l.altitudeMaxKm))
    : 400;
  const escapeAltitudeKm = outermostAltitudeKm * 1.3; // draw a bit past the outermost layer
  const takeoffRad = (takeoffAngleDeg * Math.PI) / 180;
  const horizontalM = (escapeAltitudeKm / Math.tan(takeoffRad)) * 1000;
  return [
    { planeDistanceM: 0, altitudeKm: 0 },
    { planeDistanceM: horizontalM, altitudeKm: escapeAltitudeKm },
  ];
}
