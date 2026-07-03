import { coordsToLocator } from './maidenhead.ts';

/** User setting: maximum locator precision to allow (progressive by zoom). */
export type MaidenheadGridMode = 'off' | '4' | '6' | '8';

export type GridPrecision = 4 | 6 | 8;

export interface MapBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface GridLine {
  positions: [number, number][];
  level: GridPrecision;
}

export interface GridLabel {
  position: [number, number];
  text: string;
  level: GridPrecision;
}

const LON_STEP_4 = 2;
const LAT_STEP_4 = 1;
const LON_STEP_6 = 2 / 24;
const LAT_STEP_6 = 1 / 24;
const LON_STEP_8 = 2 / 240;
const LAT_STEP_8 = 1 / 240;
const ORIGIN_LON = -180;
const ORIGIN_LAT = -90;

const DEFAULT_BUFFER_DEG = 0.5;

/** Finest 6-char lines/labels appear at this Leaflet zoom or above (when max ≥ 6). */
export const MIN_ZOOM_FOR_6_DETAIL = 10;

/** Finest 8-char lines/labels appear at this Leaflet zoom or above (when max = 8). */
export const MIN_ZOOM_FOR_8_DETAIL = 15;

const LEVEL_STEPS: Record<GridPrecision, { lon: number; lat: number }> = {
  4: { lon: LON_STEP_4, lat: LAT_STEP_4 },
  6: { lon: LON_STEP_6, lat: LAT_STEP_6 },
  8: { lon: LON_STEP_8, lat: LAT_STEP_8 },
};

function maxPrecision(mode: MaidenheadGridMode): GridPrecision | null {
  if (mode === 'off') return null;
  return Number(mode) as GridPrecision;
}

/** Finest grid precision to render for the current max setting and zoom. */
export function activeGridDetail(
  maxMode: MaidenheadGridMode,
  zoom: number | undefined,
): GridPrecision | null {
  const max = maxPrecision(maxMode);
  if (max == null) return null;
  if (zoom == null) return max;

  if (max >= 8 && zoom >= MIN_ZOOM_FOR_8_DETAIL) return 8;
  if (max >= 6 && zoom >= MIN_ZOOM_FOR_6_DETAIL) return 6;
  return 4;
}

function padBounds(bounds: MapBounds, bufferDeg: number): MapBounds {
  return {
    south: Math.max(-90, bounds.south - bufferDeg),
    west: bounds.west - bufferDeg,
    north: Math.min(90, bounds.north + bufferDeg),
    east: bounds.east + bufferDeg,
  };
}

function enumBoundaries(min: number, max: number, step: number, origin: number): number[] {
  const nStart = Math.floor((min - origin) / step);
  const nEnd = Math.ceil((max - origin) / step);
  const out: number[] = [];
  for (let n = nStart; n <= nEnd; n++) {
    out.push(origin + n * step);
  }
  return out;
}

function verticalLine(lon: number, bounds: MapBounds): GridLine['positions'] {
  return [
    [bounds.south, lon],
    [bounds.north, lon],
  ];
}

function horizontalLine(lat: number, bounds: MapBounds): GridLine['positions'] {
  return [
    [lat, bounds.west],
    [lat, bounds.east],
  ];
}

function addLevelLines(
  lines: GridLine[],
  bounds: MapBounds,
  level: GridPrecision,
  lonStep: number,
  latStep: number,
): void {
  for (const lon of enumBoundaries(bounds.west, bounds.east, lonStep, ORIGIN_LON)) {
    lines.push({ positions: verticalLine(lon, bounds), level });
  }
  for (const lat of enumBoundaries(bounds.south, bounds.north, latStep, ORIGIN_LAT)) {
    lines.push({ positions: horizontalLine(lat, bounds), level });
  }
}

export function computeGridLines(
  bounds: MapBounds,
  maxMode: MaidenheadGridMode,
  bufferDeg = DEFAULT_BUFFER_DEG,
  zoom?: number,
): GridLine[] {
  const active = activeGridDetail(maxMode, zoom);
  if (active == null) return [];

  const padded = padBounds(bounds, bufferDeg);
  const lines: GridLine[] = [];

  for (const level of [4, 6, 8] as const) {
    if (level > active) break;
    const { lon, lat } = LEVEL_STEPS[level];
    addLevelLines(lines, padded, level, lon, lat);
  }

  return lines;
}

function forEachCellCentre(
  bounds: MapBounds,
  lonStep: number,
  latStep: number,
  fn: (lat: number, lon: number) => void,
): void {
  const nMin = Math.floor((bounds.west - ORIGIN_LON) / lonStep);
  const nMax = Math.floor((bounds.east - ORIGIN_LON) / lonStep);
  const mMin = Math.floor((bounds.south - ORIGIN_LAT) / latStep);
  const mMax = Math.floor((bounds.north - ORIGIN_LAT) / latStep);

  for (let n = nMin; n <= nMax; n++) {
    for (let m = mMin; m <= mMax; m++) {
      const centreLon = ORIGIN_LON + n * lonStep + lonStep / 2;
      const centreLat = ORIGIN_LAT + m * latStep + latStep / 2;
      if (
        centreLat >= bounds.south &&
        centreLat <= bounds.north &&
        centreLon >= bounds.west &&
        centreLon <= bounds.east
      ) {
        fn(centreLat, centreLon);
      }
    }
  }
}

export function computeGridLabels(
  bounds: MapBounds,
  maxMode: MaidenheadGridMode,
  bufferDeg = DEFAULT_BUFFER_DEG,
  zoom?: number,
): GridLabel[] {
  const active = activeGridDetail(maxMode, zoom);
  if (active == null) return [];

  const padded = padBounds(bounds, bufferDeg);
  const labels: GridLabel[] = [];
  const { lon, lat } = LEVEL_STEPS[active];

  forEachCellCentre(padded, lon, lat, (centreLat, centreLon) => {
    labels.push({
      position: [centreLat, centreLon],
      text: coordsToLocator(centreLat, centreLon, active),
      level: active,
    });
  });

  return labels;
}
