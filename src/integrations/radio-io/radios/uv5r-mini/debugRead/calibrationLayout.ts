/**
 * The UV-5R Mini calibration area (`0xF000–0xFFFF` of a full read) as shape: which address range holds what, and a
 * decoder from a decoded 64 KiB read to typed values for the debug page's read-only viewer. No I/O, no radio's values:
 * address ranges, segments and formulas only.
 *
 * The PA bias block holds 4 frequency segments × 3 power levels × 16 points, one byte each. Nothing in this repo says
 * in which order the twelve 16-byte rows are stored; this module assumes **segment-major** (row = segment × 3 + power
 * level), and the viewer says so.
 */

import { UV5R_MINI_FULL_READ_SIZE } from './fullRead.ts';

export const UV5R_MINI_CALIBRATION_START = 0xf000;
export const UV5R_MINI_CALIBRATION_END = 0x10000;

/** One frequency segment of the PA bias block: point `i` sits at `baseMhz + stepMhz × i`. */
export interface Uv5rMiniPaSegment {
  index: number;
  baseMhz: number;
  stepMhz: number;
}

export const UV5R_MINI_PA_POINTS = 16;
export const UV5R_MINI_PA_LEVELS = 3;

export const UV5R_MINI_PA_SEGMENTS: readonly Uv5rMiniPaSegment[] = [
  { index: 0, baseMhz: 130, stepMhz: 3 },
  { index: 1, baseMhz: 200, stepMhz: 5 },
  { index: 2, baseMhz: 350, stepMhz: 5 },
  { index: 3, baseMhz: 400, stepMhz: 10 },
];

/** The assumed row order inside `0xF000–0xF0BF`, shown on the page. */
export const UV5R_MINI_PA_ORDER = 'segment-major' as const;

/** MHz of point `i` of a segment. */
export function uv5rMiniPaPointMhz(segment: Uv5rMiniPaSegment, i: number): number {
  return segment.baseMhz + segment.stepMhz * i;
}

/** Address of one PA bias byte, segment-major (assumed). */
export function uv5rMiniPaAddress(segment: number, level: number, point: number): number {
  return (
    UV5R_MINI_CALIBRATION_START +
    (segment * UV5R_MINI_PA_LEVELS + level) * UV5R_MINI_PA_POINTS +
    point
  );
}

export type Uv5rMiniCalibrationKind =
  'paBias' | 'squelch' | 'battery' | 'value' | 'trim' | 'text' | 'partlyTraced' | 'untraced';

/** One range of the calibration area. Ends are exclusive. */
export interface Uv5rMiniCalibrationRange {
  id: string;
  label: string;
  start: number;
  end: number;
  kind: Uv5rMiniCalibrationKind;
}

const r = (
  id: string,
  label: string,
  start: number,
  end: number,
  kind: Uv5rMiniCalibrationKind,
): Uv5rMiniCalibrationRange => ({ id, label, start, end, kind });

/**
 * The calibration area, `0xF000–0xFFFF`, in address order with no gaps or overlaps. The region byte (`0xF255`) is the
 * last byte of the model suffix and is listed in {@link UV5R_MINI_CALIBRATION_REGION} instead.
 */
export const UV5R_MINI_CALIBRATION_LAYOUT: readonly Uv5rMiniCalibrationRange[] = [
  r('paBias', 'PA bias', 0xf000, 0xf0c0, 'paBias'),
  r('f0c0', 'Partly traced', 0xf0c0, 0xf100, 'partlyTraced'),
  r('squelch0', 'Squelch row', 0xf100, 0xf110, 'squelch'),
  r('squelch1', 'Squelch row', 0xf110, 0xf120, 'squelch'),
  r('f120', 'Untraced', 0xf120, 0xf200, 'untraced'),
  r('battery', 'Battery thresholds', 0xf200, 0xf206, 'battery'),
  r('f206', 'Untraced', 0xf206, 0xf211, 'untraced'),
  r('ctcssTx', 'CTCSS TX level', 0xf211, 0xf212, 'value'),
  r('dcsTx', 'DCS TX level', 0xf212, 0xf213, 'value'),
  r('afGain0', 'AF gain (0xF213)', 0xf213, 0xf214, 'value'),
  r('afGain1', 'AF gain (0xF214)', 0xf214, 0xf215, 'value'),
  r('f215', 'Untraced', 0xf215, 0xf216, 'untraced'),
  r('trim', 'Frequency trim index', 0xf216, 0xf217, 'trim'),
  r('f217', 'Untraced', 0xf217, 0xf21b, 'untraced'),
  r('filter0', 'Audio filter set (0xF21B)', 0xf21b, 0xf21c, 'value'),
  r('filter1', 'Audio filter set (0xF21C)', 0xf21c, 0xf21d, 'value'),
  r('filter2', 'Audio filter set (0xF21D)', 0xf21d, 0xf21e, 'value'),
  r('filter3', 'Audio filter set (0xF21E)', 0xf21e, 0xf21f, 'value'),
  r('f21f', 'Untraced', 0xf21f, 0xf230, 'untraced'),
  r('bandLimits', 'Band limits', 0xf230, 0xf245, 'text'),
  r('f245', 'Untraced', 0xf245, 0xf250, 'untraced'),
  r('modelSuffix', 'Model suffix', 0xf250, 0xf256, 'text'),
  r('f256', 'Untraced', 0xf256, 0x10000, 'untraced'),
];

/** The region byte: the model suffix's last byte. */
export const UV5R_MINI_CALIBRATION_REGION = { id: 'region', label: 'Region byte', address: 0xf255 };

/** Six battery threshold bytes; `battery.blank` says all six read `0xFF`. */
export const UV5R_MINI_BATTERY_STEPS = 6;

/**
 * The frequency trim: an index 0–16 into a 17-entry table, 8 the centre (0 ppm), 0.5 ppm a step,
 * so ±4 ppm at the ends. The firmware uses index 8 for any value above 16.
 */
export const UV5R_MINI_TRIM_CENTRE = 8;
export const UV5R_MINI_TRIM_MAX = 16;
export const UV5R_MINI_TRIM_PPM_PER_STEP = 0.5;
/** The gauge's half-width in ppm. */
export const UV5R_MINI_TRIM_SPAN_PPM = 4;

/** The index the firmware applies for a trim byte: the byte itself, or the centre above 16. */
export function uv5rMiniTrimIndex(value: number): number {
  return value > UV5R_MINI_TRIM_MAX ? UV5R_MINI_TRIM_CENTRE : value;
}

/** The trim in ppm the firmware applies for a trim byte. */
export function uv5rMiniTrimPpm(value: number): number {
  return (uv5rMiniTrimIndex(value) - UV5R_MINI_TRIM_CENTRE) * UV5R_MINI_TRIM_PPM_PER_STEP;
}

export interface Uv5rMiniPaLine {
  level: number;
  points: { i: number; mhz: number; address: number; value: number }[];
}

export interface Uv5rMiniPaSegmentValues {
  segment: Uv5rMiniPaSegment;
  levels: Uv5rMiniPaLine[];
}

export interface Uv5rMiniCalibrationValue {
  id: string;
  label: string;
  address: number;
  value: number;
}

export interface Uv5rMiniCalibrationBytes {
  id: string;
  label: string;
  start: number;
  end: number;
  bytes: Uint8Array;
}

export interface Uv5rMiniCalibrationText extends Uv5rMiniCalibrationBytes {
  /** Printable ASCII, other bytes as `.`. */
  ascii: string;
}

export interface Uv5rMiniCalibration {
  /** `0xF000` reads `0xFF`: the firmware treats calibration as absent. */
  blank: boolean;
  paBias: Uv5rMiniPaSegmentValues[];
  squelch: Uv5rMiniCalibrationBytes[];
  /** `blank`: all six bytes read `0xFF`. Says nothing about which thresholds the firmware uses. */
  battery: { start: number; values: number[]; blank: boolean };
  values: Uv5rMiniCalibrationValue[];
  /** `ppm`: the trim the firmware applies; `aboveRange`: the byte is above 16, so index 8 is used. */
  trim: Uv5rMiniCalibrationValue & { ppm: number; aboveRange: boolean };
  region: Uv5rMiniCalibrationValue;
  texts: Uv5rMiniCalibrationText[];
  /** `partlyTraced` and `untraced` ranges, as bytes. */
  hex: (Uv5rMiniCalibrationBytes & { kind: 'partlyTraced' | 'untraced' })[];
}

function ascii(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')).join('');
}

/** Decode the calibration area of a decoded 64 KiB full read. Read only: returns copies. */
export function decodeUv5rMiniCalibration(decoded: Uint8Array): Uv5rMiniCalibration {
  if (decoded.length < UV5R_MINI_FULL_READ_SIZE) {
    throw new Error(
      `A full read is ${UV5R_MINI_FULL_READ_SIZE} bytes; got ${decoded.length}, so it has no calibration area`,
    );
  }
  const bytesOf = (range: Uv5rMiniCalibrationRange): Uv5rMiniCalibrationBytes => ({
    id: range.id,
    label: range.label,
    start: range.start,
    end: range.end,
    bytes: decoded.slice(range.start, range.end),
  });

  const paBias = UV5R_MINI_PA_SEGMENTS.map((segment) => ({
    segment,
    levels: Array.from({ length: UV5R_MINI_PA_LEVELS }, (_, level) => ({
      level,
      points: Array.from({ length: UV5R_MINI_PA_POINTS }, (_, i) => {
        const address = uv5rMiniPaAddress(segment.index, level, i);
        return { i, mhz: uv5rMiniPaPointMhz(segment, i), address, value: decoded[address] };
      }),
    })),
  }));

  const ofKind = (kind: Uv5rMiniCalibrationKind) =>
    UV5R_MINI_CALIBRATION_LAYOUT.filter((x) => x.kind === kind);

  const batteryRange = ofKind('battery')[0];
  const batteryValues = Array.from(decoded.subarray(batteryRange.start, batteryRange.end));

  const trimRange = ofKind('trim')[0];
  const trimValue = decoded[trimRange.start];

  return {
    blank: decoded[UV5R_MINI_CALIBRATION_START] === 0xff,
    paBias,
    squelch: ofKind('squelch').map(bytesOf),
    battery: {
      start: batteryRange.start,
      values: batteryValues,
      blank: batteryValues.every((b) => b === 0xff),
    },
    values: ofKind('value').map((x) => ({
      id: x.id,
      label: x.label,
      address: x.start,
      value: decoded[x.start],
    })),
    trim: {
      id: trimRange.id,
      label: trimRange.label,
      address: trimRange.start,
      value: trimValue,
      ppm: uv5rMiniTrimPpm(trimValue),
      aboveRange: trimValue > UV5R_MINI_TRIM_MAX,
    },
    region: {
      ...UV5R_MINI_CALIBRATION_REGION,
      value: decoded[UV5R_MINI_CALIBRATION_REGION.address],
    },
    texts: ofKind('text').map((x) => {
      const b = bytesOf(x);
      return { ...b, ascii: ascii(b.bytes) };
    }),
    hex: UV5R_MINI_CALIBRATION_LAYOUT.filter(
      (x): x is Uv5rMiniCalibrationRange & { kind: 'partlyTraced' | 'untraced' } =>
        x.kind === 'partlyTraced' || x.kind === 'untraced',
    ).map((x) => ({ ...bytesOf(x), kind: x.kind })),
  };
}
