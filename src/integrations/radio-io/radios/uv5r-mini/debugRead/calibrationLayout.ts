/**
 * The UV-5R Mini calibration area (`0xF000–0xFFFF` of a full read) as shape: which address range holds what, and a
 * decoder from a decoded 64 KiB read to typed values for the debug page's read-only viewer. No I/O, no radio's values:
 * address ranges, indexing and formulas only.
 *
 * Source: the radio repo's static trace of v0.04 `app.bin` (PR #219, ledger F302-F309; v0.27 runs the same code
 * relocated). Confidence uses the debug pages' vocabulary: `traced` (code address and meaning), `partly` (traced use,
 * inferred meaning, marked "inferred"), `unknown`. A byte nothing reads is **unused (no reader)**, never unknown.
 *
 * The PA bias block is three 64-byte frames, one per power index (`0xF000` 0 High, `0xF040` 2, `0xF080` 1 Low), each
 * holding four 16-byte rows in band order UHF, VHF, 200, 350 MHz. The calibration was written as ten whole clone
 * frames from one buffer, so bytes nothing reads are **frame residue**, not free space: the calibration sector is
 * erased whole by a `W` at `0xF000`. Nothing here is permission to write it.
 */

import { UV5R_MINI_FULL_READ_SIZE } from './fullRead.ts';

export const UV5R_MINI_CALIBRATION_START = 0xf000;
export const UV5R_MINI_CALIBRATION_END = 0x10000;

export type Uv5rMiniConfidence = 'traced' | 'partly' | 'unknown';

/** One band row of a PA bias frame: point `i` sits at `baseMhz + stepMhz × i`. */
export interface Uv5rMiniPaSegment {
  /** Row index inside a frame: the row starts `index × 16` bytes into it. */
  index: number;
  label: string;
  baseMhz: number;
  stepMhz: number;
  /** Points the firmware reads; the rest of the 16 bytes have no reader. */
  usedPoints: number;
  /** False where the row is not calibrated (all zero on the radios read). */
  calibrated: boolean;
  /** How the firmware turns a frequency into a point index. */
  indexRule: string;
}

export const UV5R_MINI_PA_POINTS = 16;
export const UV5R_MINI_PA_LEVELS = 3;

/** The four band rows, in the order they sit inside each frame (traced: loader `0x1E48F94`, table `0x1E659A0`). */
export const UV5R_MINI_PA_SEGMENTS: readonly Uv5rMiniPaSegment[] = [
  {
    index: 0,
    label: 'UHF',
    baseMhz: 400,
    stepMhz: 10,
    usedPoints: 13,
    calibrated: true,
    indexRule: '(MHz − 400) / 10, unclamped',
  },
  {
    index: 1,
    label: 'VHF',
    baseMhz: 130,
    stepMhz: 3,
    usedPoints: 16,
    calibrated: true,
    indexRule: '(MHz − 130) / 3, clamped to 15',
  },
  {
    index: 2,
    label: '200 MHz',
    baseMhz: 200,
    stepMhz: 5,
    usedPoints: 13,
    calibrated: true,
    indexRule: '(MHz − 200) / 5',
  },
  {
    index: 3,
    label: '350 MHz',
    baseMhz: 350,
    stepMhz: 5,
    usedPoints: 13,
    calibrated: false,
    indexRule: '(MHz − 350) / 5',
  },
];

/** One PA bias frame: the power index it serves and where it sits. */
export interface Uv5rMiniPaFrame {
  /** The power index the firmware uses (the VFO frame's power byte). */
  level: number;
  frameStart: number;
  name: string;
  /** `partly`: the index is traced, the name inferred. */
  confidence: Uv5rMiniConfidence;
}

/** Listed by power index; in the address space the frames run power 0, 2, 1. */
export const UV5R_MINI_PA_FRAMES: readonly Uv5rMiniPaFrame[] = [
  { level: 0, frameStart: 0xf000, name: 'High', confidence: 'traced' },
  { level: 1, frameStart: 0xf080, name: 'Low', confidence: 'traced' },
  { level: 2, frameStart: 0xf040, name: 'Level 2 (no menu entry)', confidence: 'partly' },
];

/** The row order of the PA bias block, shown on the page (traced). */
export const UV5R_MINI_PA_ORDER = 'power-major' as const;

/** MHz of point `i` of a band row. */
export function uv5rMiniPaPointMhz(segment: Uv5rMiniPaSegment, i: number): number {
  return segment.baseMhz + segment.stepMhz * i;
}

/** Address of one PA bias byte: the power index's frame, the band row inside it, the point. */
export function uv5rMiniPaAddress(segment: number, level: number, point: number): number {
  return UV5R_MINI_PA_FRAMES[level].frameStart + segment * UV5R_MINI_PA_POINTS + point;
}

export type Uv5rMiniCalibrationKind =
  | 'paBias'
  | 'squelchThreshold'
  | 'squelchOffset'
  | 'battery'
  | 'value'
  | 'trim'
  | 'bandLimits'
  | 'text'
  | 'region'
  | 'residue'
  | 'erased';

/** One range of the calibration area. Ends are exclusive. */
export interface Uv5rMiniCalibrationRange {
  id: string;
  label: string;
  start: number;
  end: number;
  kind: Uv5rMiniCalibrationKind;
  confidence: Uv5rMiniConfidence;
  /** Leading bytes the firmware reads; the rest of the range has no reader. Default: all of it. */
  used?: number;
  /** Meaning, encoding and evidence (function address or ledger id). */
  note: string;
}

const r = (
  id: string,
  label: string,
  start: number,
  end: number,
  kind: Uv5rMiniCalibrationKind,
  note: string,
  extra: { confidence?: Uv5rMiniConfidence; used?: number } = {},
): Uv5rMiniCalibrationRange => ({
  id,
  label,
  start,
  end,
  kind,
  note,
  confidence: extra.confidence ?? 'traced',
  ...(extra.used === undefined ? {} : { used: extra.used }),
});

const RESIDUE = 'Frame residue (no reader)';
const RESIDUE_NOTE =
  'Copy left by the PC tool writing whole 64-byte frames from one buffer; nothing in the firmware reads it (cause inferred)';
const residue = (id: string, start: number, end: number, note = RESIDUE_NOTE) =>
  r(id, RESIDUE, start, end, 'residue', note, { confidence: 'partly' });

/**
 * The calibration area, `0xF000–0xFFFF`, in address order with no gaps or overlaps. Every byte is a field, frame
 * residue or erased: none of it is free space.
 */
export const UV5R_MINI_CALIBRATION_LAYOUT: readonly Uv5rMiniCalibrationRange[] = [
  r(
    'paBias',
    'PA bias',
    0xf000,
    0xf0c0,
    'paBias',
    'Three frames by power index (F000 High, F040 level 2, F080 Low), four 16-byte rows each: UHF, VHF, 200, 350 MHz. The byte becomes the high byte of RF register 0x36 (0 gives 0x007F). Loader 0x1E48F94, table 0x1E659A0; level 2 has no menu entry (name inferred)',
  ),
  r(
    'squelchOpen',
    'Squelch open threshold',
    0xf0c0,
    0xf0ca,
    'squelchThreshold',
    'Levels 0-9, RSSI counts; RF register 0x78 high byte = value − frequency offset (0x1E506E2). Below 130 MHz and at 180-199 MHz the firmware ignores the level: open from the level-9 entry, close = open − 3 (0x1E50F1C)',
  ),
  residue('f0ca', 0xf0ca, 0xf0d0),
  r(
    'squelchClose',
    'Squelch close threshold',
    0xf0d0,
    0xf0da,
    'squelchThreshold',
    'Levels 0-9; RF register 0x78 low byte = value − frequency offset (0x1E50C52)',
  ),
  residue('f0da', 0xf0da, 0xf0e0),
  r(
    'squelchOffsetUhf',
    'Squelch offset, UHF',
    0xf0e0,
    0xf0f0,
    'squelchOffset',
    'Subtracted from open and close; index (MHz − 400) / 10, 13 used (0x1E50706)',
    { used: 13 },
  ),
  r(
    'squelchOffsetVhf',
    'Squelch offset, VHF',
    0xf0f0,
    0xf100,
    'squelchOffset',
    'Index (MHz − 130) / 5 clamped to 9, 10 used; byte 0 also feeds the out-of-band fixed threshold (0x1E50B1C, 0x1E50F20)',
    { used: 10 },
  ),
  r(
    'squelchOffset200',
    'Squelch offset, 200 MHz',
    0xf100,
    0xf110,
    'squelchOffset',
    'Per-frequency offset, not a squelch row of its own; index (MHz − 200) / 5, 13 used (0x1E50C46, RAM 0x19B30)',
    { used: 13 },
  ),
  r(
    'squelchOffset350',
    'Squelch offset, 350 MHz',
    0xf110,
    0xf11d,
    'squelchOffset',
    'Per-frequency offset; index (MHz − 350) / 5, 10 used (0x1E5072E, RAM 0x19B20)',
    { used: 10 },
  ),
  residue('f11d', 0xf11d, 0xf120),
  residue(
    'f120',
    0xf120,
    0xf200,
    'Copies of F0E0-F11F left by the PC tool writing whole frames; nothing in the firmware reads them (cause inferred)',
  ),
  r(
    'battery',
    'Battery thresholds',
    0xf200,
    0xf206,
    'battery',
    'Six thresholds (0x1E46DFA; radio repo F158)',
  ),
  residue('f206', 0xf206, 0xf210),
  r(
    'mic',
    'Mic sensitivity',
    0xf210,
    0xf211,
    'value',
    'RF register 0x7D low bits: 6 bits in v0.04, 5 bits in v0.27 (radio repo F281)',
  ),
  r('ctcssTx', 'CTCSS TX level', 0xf211, 0xf212, 'value', 'Radio repo F152'),
  r('dcsTx', 'DCS TX level', 0xf212, 0xf213, 'value', 'Radio repo F152'),
  r('afGain0', 'AF gain (0xF213)', 0xf213, 0xf214, 'value', 'Radio repo F152'),
  r('afGain1', 'AF gain (0xF214)', 0xf214, 0xf215, 'value', 'Radio repo F152'),
  residue('f215', 0xf215, 0xf216),
  r(
    'trim',
    'Frequency trim index',
    0xf216,
    0xf217,
    'trim',
    'Index 0-16 into a 17-entry table (0x1E4D90A)',
  ),
  residue('f217', 0xf217, 0xf21b),
  r(
    'filter0',
    'Audio filter set (0xF21B)',
    0xf21b,
    0xf21c,
    'value',
    'v0.04 only (radio repo F222)',
  ),
  r(
    'filter1',
    'Audio filter set (0xF21C)',
    0xf21c,
    0xf21d,
    'value',
    'v0.04 only (radio repo F222)',
  ),
  r(
    'filter2',
    'Audio filter set (0xF21D)',
    0xf21d,
    0xf21e,
    'value',
    'v0.04 only (radio repo F222)',
  ),
  r(
    'filter3',
    'Audio filter set (0xF21E)',
    0xf21e,
    0xf21f,
    'value',
    'v0.04 only (radio repo F222)',
  ),
  residue('f21f', 0xf21f, 0xf230),
  r(
    'bandLimits',
    'Band limits (BCD)',
    0xf230,
    0xf245,
    'bandLimits',
    'Four (low, high) MHz pairs as BCD in bytes 1-4, 6-9, 11-14, 17-20; bytes 0, 5, 10, 15, 16 are never sent or read (flags, unused). Read only by the clone F reply (0x1E4CE4C). The firmware does not use these: it takes its RX band edges from the region byte',
    { used: 16 },
  ),
  residue('f245', 0xf245, 0xf250),
  r(
    'modelSuffix',
    'Model suffix',
    0xf250,
    0xf255,
    'text',
    'Five ASCII digits, sent by the clone M reply',
  ),
  r(
    'region',
    'Region byte',
    0xf255,
    0xf256,
    'region',
    "ASCII digit; the firmware uses its low nibble when '0'-'8', else 0, to pick the built-in RX band-edge table (loader tail)",
  ),
  residue('f256', 0xf256, 0xf280),
  r(
    'erased',
    'Erased, unused',
    0xf280,
    0x10000,
    'erased',
    'Erased on both radios read; never read or written by the firmware',
  ),
];

/** The region byte's address. */
export const UV5R_MINI_CALIBRATION_REGION = { id: 'region', label: 'Region byte', address: 0xf255 };

/** The region table the firmware picks: the byte's low nibble when it is an ASCII digit `0`-`8`, else 0. */
export function uv5rMiniRegionTable(value: number): number {
  return value >= 0x30 && value <= 0x38 ? value & 0x0f : 0;
}

/** Totals over the layout, for the docs and the tests: fields by confidence, bytes by role. */
export function uv5rMiniCalibrationCounts(): {
  fields: Record<Uv5rMiniConfidence, number>;
  bytesInFields: number;
  residue: number;
  erased: number;
  unknown: number;
} {
  const fields: Record<Uv5rMiniConfidence, number> = { traced: 0, partly: 0, unknown: 0 };
  let bytesInFields = 0;
  let residueBytes = 0;
  let erased = 0;
  let unknown = 0;
  for (const range of UV5R_MINI_CALIBRATION_LAYOUT) {
    const size = range.end - range.start;
    if (range.kind === 'residue') residueBytes += size;
    else if (range.kind === 'erased') erased += size;
    else {
      fields[range.confidence]++;
      bytesInFields += size;
      if (range.confidence === 'unknown') unknown += size;
    }
  }
  return { fields, bytesInFields, residue: residueBytes, erased, unknown };
}

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
  /** The power index's name, and the confidence of that name. */
  name: string;
  confidence: Uv5rMiniConfidence;
  frameStart: number;
  points: { i: number; mhz: number; address: number; value: number; used: boolean }[];
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
  confidence: Uv5rMiniConfidence;
  note: string;
}

export interface Uv5rMiniCalibrationBytes {
  id: string;
  label: string;
  start: number;
  end: number;
  bytes: Uint8Array;
  confidence: Uv5rMiniConfidence;
  note: string;
  /** Leading bytes the firmware reads; the rest have no reader. */
  used: number;
}

export interface Uv5rMiniCalibrationText extends Uv5rMiniCalibrationBytes {
  /** Printable ASCII, other bytes as `.`. */
  ascii: string;
}

/** One band-limit pair, decoded from BCD; `null` where a nibble is not a decimal digit. */
export interface Uv5rMiniBandLimit {
  index: number;
  address: number;
  lowMhz: number | null;
  highMhz: number | null;
}

/** Band-limit pairs sit at these offsets inside the 21-byte range, 4 bytes each: low (2 BCD bytes), high (2). */
export const UV5R_MINI_BAND_LIMIT_OFFSETS: readonly number[] = [1, 6, 11, 17];

/** Two BCD bytes (4 digits, high nibble first) as a number, or `null` if any nibble is above 9. */
export function uv5rMiniBcd16(hi: number, lo: number): number | null {
  const digits = [hi >> 4, hi & 15, lo >> 4, lo & 15];
  if (digits.some((d) => d > 9)) return null;
  return digits.reduce((n, d) => n * 10 + d, 0);
}

export interface Uv5rMiniCalibration {
  /** `0xF000` reads `0xFF`: the firmware treats calibration as absent. */
  blank: boolean;
  paBias: Uv5rMiniPaSegmentValues[];
  squelch: {
    thresholds: Uv5rMiniCalibrationBytes[];
    offsets: Uv5rMiniCalibrationBytes[];
  };
  /** `blank`: all six bytes read `0xFF`. Says nothing about which thresholds the firmware uses. */
  battery: { start: number; values: number[]; blank: boolean };
  values: Uv5rMiniCalibrationValue[];
  /** `ppm`: the trim the firmware applies; `aboveRange`: the byte is above 16, so index 8 is used. */
  trim: Uv5rMiniCalibrationValue & { ppm: number; aboveRange: boolean };
  /** `table`: the built-in band-edge table the firmware picks from this byte. */
  region: Uv5rMiniCalibrationValue & { table: number };
  texts: Uv5rMiniCalibrationText[];
  bandLimits: Uv5rMiniCalibrationBytes & { bands: Uv5rMiniBandLimit[] };
  /** `residue` and `erased` ranges, as bytes. */
  hex: (Uv5rMiniCalibrationBytes & { kind: 'residue' | 'erased' })[];
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
    confidence: range.confidence,
    note: range.note,
    used: range.used ?? range.end - range.start,
  });
  const valueOf = (range: Uv5rMiniCalibrationRange): Uv5rMiniCalibrationValue => ({
    id: range.id,
    label: range.label,
    address: range.start,
    value: decoded[range.start],
    confidence: range.confidence,
    note: range.note,
  });

  const paBias = UV5R_MINI_PA_SEGMENTS.map((segment) => ({
    segment,
    levels: UV5R_MINI_PA_FRAMES.map((frame) => ({
      level: frame.level,
      name: frame.name,
      confidence: frame.confidence,
      frameStart: frame.frameStart,
      points: Array.from({ length: UV5R_MINI_PA_POINTS }, (_, i) => {
        const address = uv5rMiniPaAddress(segment.index, frame.level, i);
        return {
          i,
          mhz: uv5rMiniPaPointMhz(segment, i),
          address,
          value: decoded[address],
          used: i < segment.usedPoints,
        };
      }),
    })),
  }));

  const ofKind = (kind: Uv5rMiniCalibrationKind) =>
    UV5R_MINI_CALIBRATION_LAYOUT.filter((x) => x.kind === kind);

  const batteryRange = ofKind('battery')[0];
  const batteryValues = Array.from(decoded.subarray(batteryRange.start, batteryRange.end));

  const trimRange = ofKind('trim')[0];
  const trimValue = decoded[trimRange.start];

  const regionRange = ofKind('region')[0];
  const regionValue = decoded[regionRange.start];

  const bandRange = ofKind('bandLimits')[0];
  const bandBytes = bytesOf(bandRange);
  const bands = UV5R_MINI_BAND_LIMIT_OFFSETS.map((offset, index) => {
    const b = bandBytes.bytes;
    return {
      index,
      address: bandRange.start + offset,
      lowMhz: uv5rMiniBcd16(b[offset], b[offset + 1]),
      highMhz: uv5rMiniBcd16(b[offset + 2], b[offset + 3]),
    };
  });

  return {
    blank: decoded[UV5R_MINI_CALIBRATION_START] === 0xff,
    paBias,
    squelch: {
      thresholds: ofKind('squelchThreshold').map(bytesOf),
      offsets: ofKind('squelchOffset').map(bytesOf),
    },
    battery: {
      start: batteryRange.start,
      values: batteryValues,
      blank: batteryValues.every((b) => b === 0xff),
    },
    values: ofKind('value').map(valueOf),
    trim: {
      ...valueOf(trimRange),
      ppm: uv5rMiniTrimPpm(trimValue),
      aboveRange: trimValue > UV5R_MINI_TRIM_MAX,
    },
    region: { ...valueOf(regionRange), table: uv5rMiniRegionTable(regionValue) },
    texts: ofKind('text').map((x) => {
      const b = bytesOf(x);
      return { ...b, ascii: ascii(b.bytes) };
    }),
    bandLimits: { ...bandBytes, bands },
    hex: UV5R_MINI_CALIBRATION_LAYOUT.filter(
      (x): x is Uv5rMiniCalibrationRange & { kind: 'residue' | 'erased' } =>
        x.kind === 'residue' || x.kind === 'erased',
    ).map((x) => ({ ...bytesOf(x), kind: x.kind })),
  };
}
