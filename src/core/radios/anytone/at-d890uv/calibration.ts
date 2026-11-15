/**
 * AT-D890UV tune (calibration) unit decoder — read-only, static-trace fields only (#1697).
 *
 * Input bytes start at offset zero of the 256 KiB tune unit requested at 0x04F00000 ("tune-a") and may be a captured
 * prefix. Every field is a statically traced V1.05 consumer; nothing here is validated on hardware. Multi-byte
 * fields are read as little-endian by assumption: the decompile does not establish byte order. Missing bytes stay
 * `undefined`; captured 0x00 and 0xFF are actual values. Bytes not listed here remain unknown raw data.
 *
 * See docs/reference/radios/anytone/at-d890uv/calibration.md.
 */

/** Size of one tune unit (one erase unit). */
export const AT_D890_TUNE_UNIT_BYTES = 0x4_0000;
/** Neutral value of the oscillator trim word: the firmware corrects by the signed distance from it. */
export const AT_D890_TRIM_NEUTRAL = 2000;
/** Bounds of the factory editor for the trim word. Evidence of the editor only, not a validated RF limit. */
export const AT_D890_TRIM_EDITOR_BOUNDS = [0, 4000] as const;

/** How much of the static trace backs a statement: layout (offset/width) or meaning (encoding, physical sense). */
export type AtD890CalConfidence = 'traced' | 'partially-traced' | 'unknown';
/** Whether the captured prefix covers all, part or none of a field. */
export type AtD890CalAvailability = 'captured' | 'partial' | 'not-captured';
export type AtD890CalByteOrder = 'single-byte' | 'assumed-little-endian';

export interface AtD890CalSource {
  /** V1.05 firmware consumer addresses from the static trace. */
  consumers: readonly string[];
  note: string;
}

interface FieldBase {
  id: string;
  label: string;
  /** Offset from the start of the tune unit. */
  offset: number;
  /** Bytes actually captured for this field (may be shorter than the field). */
  raw: Uint8Array;
  availability: AtD890CalAvailability;
  layout: AtD890CalConfidence;
  meaning: AtD890CalConfidence;
  source: AtD890CalSource;
}

export interface AtD890CalScalar extends FieldBase {
  group: 'trim' | 'squelch' | 'meter' | 'power-reference';
  width: 1 | 2;
  byteOrder: AtD890CalByteOrder;
  /** Unsigned value; `undefined` unless every byte of the field was captured. */
  value: number | undefined;
}

export interface AtD890CalTable extends FieldBase {
  group: 'power' | 'flatness';
  /** UHF / VHF-220 power family, or the flatness path. */
  band: 'uhf' | 'vhf-220';
  /** Numeric power selection 0–3 for power tables; receiver path for flatness tables. */
  selection?: 0 | 1 | 2 | 3;
  path?: 'main' | 'sub';
  length: number;
  referenceIndex: number;
  /** Unsigned entries by index; missing positions stay `undefined`. */
  values: readonly (number | undefined)[];
  /** Index rule as documented by the trace (frequencies in MHz). */
  indexRule: string;
}

export interface AtD890CalUnknownRange {
  offset: number;
  /** Exclusive end offset. */
  end: number;
  availability: AtD890CalAvailability;
  /** Statically noted but intentionally undecoded bytes inside the range. */
  notes: readonly { offset: number; note: string }[];
}

export interface AtD890Calibration {
  availability: AtD890CalAvailability;
  capturedLength: number;
  scalars: readonly AtD890CalScalar[];
  tables: readonly AtD890CalTable[];
  unknown: readonly AtD890CalUnknownRange[];
}

const TRIM_SOURCE: AtD890CalSource = {
  consumers: ['0x08047E10', '0x08116674', '0x08122974', '0x0812DF4C', '0x0812F878'],
  note: 'Frequency corrected by signed direction around 2000, magnitude |trim − 2000| × f / 46015500; factory editor 0–4000. Physical units unknown.',
};
const SQUELCH_SOURCE: AtD890CalSource = {
  consumers: ['0x080E373C', '0x08122974'],
  note: 'Squelch reference (factory cases 1D/1E, 36–39). Valid range and physical scale unknown.',
};
const METER_SOURCE: AtD890CalSource = {
  consumers: ['0x080CF7D8', '0x080CFFBC', '0x08122974'],
  note: 'Meter reference (factory cases 1F/20, 3A–3D). Physical input level unknown.',
};
const POWER_SOURCE: AtD890CalSource = {
  consumers: ['0x0803AAF8', '0x0811A75C', '0x08123864'],
  note: 'Output = reference byte + table[index] − table[reference index]. Discrete lookup, no interpolation. Power labels and physical output unknown; 200–300 MHz forces selection 0.',
};
const FLATNESS_SOURCE: AtD890CalSource = {
  consumers: ['0x080E373C', '0x08123864'],
  note: 'Squelch flatness: table[index] − table[reference index]; differences can be negative. Bounds and physical units unknown.',
};

const UHF_POWER_RULE = 'index = floor(f − 400); reference index 40 (440 MHz)';
const VHF_POWER_RULE =
  'index = floor(f − 136) below 174.00001 MHz, otherwise floor(f − 220) + 39; reference index 9 (145 MHz)';
const UHF_FLAT_RULE = 'index = floor((f − 400) / 5); reference index 8';
const VHF_FLAT_RULE = 'index = floor((f − 136) / 2); reference index 5; 220 MHz uses index 20';

/** Intentionally undecoded bytes the trace mentions; kept as raw unknown data. */
const NOTED_UNKNOWN: readonly { offset: number; note: string }[] = [
  { offset: 0x028, note: 'LocalInfo band-code copy (0x0801EACC); not decoded here' },
  { offset: 0x200, note: 'Air-band threshold baseline (0x080D09AC); scale unknown' },
  { offset: 0x201, note: 'Air-band signal reference (0x080CF2E0 and others); scale unknown' },
  { offset: 0x207, note: 'Factory case 5B capture; consumer and meaning unknown' },
];

function availabilityOf(offset: number, width: number, captured: number): AtD890CalAvailability {
  if (captured <= offset) return 'not-captured';
  return captured >= offset + width ? 'captured' : 'partial';
}

function scalar(
  bytes: Uint8Array,
  def: Omit<AtD890CalScalar, 'raw' | 'availability' | 'value' | 'byteOrder' | 'layout' | 'meaning'>,
): AtD890CalScalar {
  const raw = bytes.slice(def.offset, def.offset + def.width);
  const availability = availabilityOf(def.offset, def.width, bytes.length);
  const value =
    availability !== 'captured' ? undefined : def.width === 1 ? raw[0] : raw[0]! | (raw[1]! << 8);
  return {
    ...def,
    raw,
    availability,
    value,
    byteOrder: def.width === 1 ? 'single-byte' : 'assumed-little-endian',
    layout: 'traced',
    meaning: 'partially-traced',
  };
}

function table(
  bytes: Uint8Array,
  def: Omit<AtD890CalTable, 'raw' | 'availability' | 'values' | 'layout' | 'meaning'>,
): AtD890CalTable {
  const raw = bytes.slice(def.offset, def.offset + def.length);
  const values = Array.from({ length: def.length }, (_, i) => raw[i]);
  return {
    ...def,
    raw,
    values,
    availability: availabilityOf(def.offset, def.length, bytes.length),
    layout: 'traced',
    meaning: 'partially-traced',
  };
}

const SELECTIONS = [0, 1, 2, 3] as const;

/** Decode the statically traced V1.05 tune fields from a tune-unit prefix. Never throws on short input. */
export function decodeAtD890Calibration(bytes: Uint8Array | undefined): AtD890Calibration {
  const data = (bytes ?? new Uint8Array(0)).subarray(0, AT_D890_TUNE_UNIT_BYTES);
  const s = (
    id: string,
    label: string,
    offset: number,
    width: 1 | 2,
    group: AtD890CalScalar['group'],
    source: AtD890CalSource,
  ) => scalar(data, { id, label, offset, width, group, source });
  const scalars: AtD890CalScalar[] = [
    s('trim', 'Oscillator trim', 0x000, 2, 'trim', TRIM_SOURCE),
    ...SELECTIONS.map((n) =>
      s(
        `uhf-power-ref-${n}`,
        `UHF power reference, selection ${n}`,
        0x002 + n,
        1,
        'power-reference',
        POWER_SOURCE,
      ),
    ),
    ...SELECTIONS.map((n) =>
      s(
        `vhf-power-ref-${n}`,
        `VHF/220 power reference, selection ${n}`,
        0x102 + n,
        1,
        'power-reference',
        POWER_SOURCE,
      ),
    ),
    ...(
      [
        ['uhf', 'UHF', 0x010, 0x014],
        ['vhf', 'VHF', 0x116, 0x11a],
        ['220', '220', 0x124, 0x128],
      ] as const
    ).flatMap(([id, band, sq, meter]) => [
      s(`${id}-squelch-main`, `${band} squelch reference, main`, sq, 2, 'squelch', SQUELCH_SOURCE),
      s(
        `${id}-squelch-sub`,
        `${band} squelch reference, sub`,
        sq + 2,
        2,
        'squelch',
        SQUELCH_SOURCE,
      ),
      s(`${id}-meter-main`, `${band} meter reference, main`, meter, 2, 'meter', METER_SOURCE),
      s(`${id}-meter-sub`, `${band} meter reference, sub`, meter + 2, 2, 'meter', METER_SOURCE),
    ]),
  ];
  const tables: AtD890CalTable[] = [
    ...SELECTIONS.map((n) =>
      table(data, {
        id: `uhf-power-${n}`,
        label: `UHF power table, selection ${n}`,
        group: 'power',
        band: 'uhf',
        selection: n,
        offset: 0xc00 + n * 0x100,
        length: 121,
        referenceIndex: 40,
        indexRule: UHF_POWER_RULE,
        source: POWER_SOURCE,
      }),
    ),
    ...SELECTIONS.map((n) =>
      table(data, {
        id: `vhf-power-${n}`,
        label: `VHF/220 power table, selection ${n}`,
        group: 'power',
        band: 'vhf-220',
        selection: n,
        offset: 0x1000 + n * 0x100,
        length: 45,
        referenceIndex: 9,
        indexRule: VHF_POWER_RULE,
        source: POWER_SOURCE,
      }),
    ),
    ...(
      [
        ['main', 'uhf', 0x1400],
        ['main', 'vhf-220', 0x1500],
        ['sub', 'uhf', 0x1600],
        ['sub', 'vhf-220', 0x1700],
      ] as const
    ).map(([path, band, offset]) =>
      table(data, {
        id: `${band}-flatness-${path}`,
        label: `${band === 'uhf' ? 'UHF' : 'VHF/220'} squelch flatness, ${path}`,
        group: 'flatness',
        band,
        path,
        offset,
        length: 25,
        referenceIndex: band === 'uhf' ? 8 : 5,
        indexRule: band === 'uhf' ? UHF_FLAT_RULE : VHF_FLAT_RULE,
        source: FLATNESS_SOURCE,
      }),
    ),
  ];
  const decoded = [
    ...scalars.map((f) => [f.offset, f.offset + f.width] as const),
    ...tables.map((t) => [t.offset, t.offset + t.length] as const),
  ].sort((a, b) => a[0] - b[0]);
  const unknown: AtD890CalUnknownRange[] = [];
  let cursor = 0;
  const pushUnknown = (start: number, end: number) => {
    if (end <= start) return;
    unknown.push({
      offset: start,
      end,
      availability: availabilityOf(start, end - start, data.length),
      notes: NOTED_UNKNOWN.filter((n) => n.offset >= start && n.offset < end),
    });
  };
  for (const [start, end] of decoded) {
    pushUnknown(cursor, start);
    cursor = Math.max(cursor, end);
  }
  pushUnknown(cursor, AT_D890_TUNE_UNIT_BYTES);
  return {
    availability:
      data.length === 0 ? 'not-captured' : availabilityOf(0, AT_D890_TUNE_UNIT_BYTES, data.length),
    capturedLength: data.length,
    scalars,
    tables,
    unknown,
  };
}

/** One table entry by exact index: no wrapping, clamping or rounding. */
export function atD890CalibrationTableValue(
  values: readonly (number | undefined)[],
  index: number,
): number | undefined {
  if (!Number.isInteger(index) || index < 0 || index >= values.length) return undefined;
  return values[index];
}

/** Signed table[index] − table[reference] as the traced arithmetic uses it; undefined when either is missing. */
export function atD890CalibrationCorrection(
  values: readonly (number | undefined)[],
  index: number,
  referenceIndex: number,
): number | undefined {
  const value = atD890CalibrationTableValue(values, index);
  const reference = atD890CalibrationTableValue(values, referenceIndex);
  return value === undefined || reference === undefined ? undefined : value - reference;
}
