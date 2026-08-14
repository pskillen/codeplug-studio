import type { PropagationMode } from '@core/domain/hfPropagation/types.ts';
import { estimateGlobePathArcLength } from '../SatelliteGlobe/globePathDash.ts';
import type { HfGlobePath } from './buildGlobeData.ts';

const DEG_RAD = Math.PI / 180;

/** Target dash/gap size along the path in radians of great-circle arc, keyed by mode. */
const MODE_DASH_ARC_RAD: Record<PropagationMode, { dash: number; gap: number }> = {
  groundwave: { dash: 0, gap: 0 },
  skywave: { dash: 3.5 * DEG_RAD, gap: 1.8 * DEG_RAD },
  nvis: { dash: 2 * DEG_RAD, gap: 1.2 * DEG_RAD },
  absorbed: { dash: 1 * DEG_RAD, gap: 3.5 * DEG_RAD },
  escaped: { dash: 0.6 * DEG_RAD, gap: 2.2 * DEG_RAD },
};

const SKIP_ZONE_DASH_ARC_RAD = 2.5 * DEG_RAD;
const TERMINATOR_DASH_LENGTH = 0.18;
const TERMINATOR_DASH_GAP = 0.05;

function fractionOfPath(points: [number, number, number][], arcRad: number): number {
  const arcLength = estimateGlobePathArcLength(points);
  if (arcLength <= 0) return 1;
  return Math.min(1, arcRad / arcLength);
}

/** Dash length as a fraction of total path length — solid groundwave; dashed otherwise. */
export function propagationPathDashLength(path: HfGlobePath): number {
  if (path.kind === 'terminator') return TERMINATOR_DASH_LENGTH;
  if (path.kind === 'skip-zone') return fractionOfPath(path.points, SKIP_ZONE_DASH_ARC_RAD);
  if (path.mode === 'groundwave') return 1;
  return fractionOfPath(path.points, MODE_DASH_ARC_RAD[path.mode].dash);
}

export function propagationPathDashGap(path: HfGlobePath): number {
  if (path.kind === 'terminator') return TERMINATOR_DASH_GAP;
  if (path.kind === 'skip-zone') return fractionOfPath(path.points, SKIP_ZONE_DASH_ARC_RAD);
  if (path.mode === 'groundwave') return 0;
  return fractionOfPath(path.points, MODE_DASH_ARC_RAD[path.mode].gap);
}
