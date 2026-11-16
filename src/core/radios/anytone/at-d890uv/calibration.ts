/**
 * AT-D890UV tune (calibration) unit decoder — read-only, static-trace fields only (#1697).
 *
 * Input bytes start at offset zero of the 256 KiB tune unit requested at 0x04F00000 ("tune-a") and may be a captured
 * prefix. Every field is a statically traced V1.05 consumer (radio repo PR #245, F349-F356); nothing here is
 * validated on hardware. Byte order is traced per region: little-endian in +0x000, +0x100, +0x200, +0x1810-+0x181B
 * and +0x1C00; big-endian in +0x300-+0x6FF and +0x1800-+0x180F (never decode those with the LE helper). Missing
 * bytes stay `undefined`; captured 0x00 and 0xFF are actual values. Bytes no code loads are `unused`, never unknown.
 *
 * See docs/reference/radios/anytone/at-d890uv/calibration.md.
 */

import {
  AT_D890_CAL_FIELD_DEFS,
  type AtD890CalFieldDef,
  type AtD890CalFieldKind,
  type AtD890CalFieldOrder,
} from './calibrationFields.ts';

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
export type AtD890CalByteOrder = 'single-byte' | 'little-endian' | 'big-endian';
/** Power selection names, from the channel record (+0x08 b3:2). Never the shifted factory letters. */
export const AT_D890_POWER_TIERS = ['Low', 'Mid', 'High', 'Turbo'] as const;
/** One trim step in ppm: the firmware shifts every RF frequency by |v − 2000| × f / 46,015,500. */
export const AT_D890_TRIM_PPM_PER_STEP = 1_000_000 / 46_015_500;

/** Signed trim offset in ppm from neutral; a higher value raises the programmed frequency. */
export function atD890TrimPpm(value: number): number {
  return (value - AT_D890_TRIM_NEUTRAL) * AT_D890_TRIM_PPM_PER_STEP;
}

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
  /** Vendor factory-mode name (secondary name), with its factory item number. */
  factoryLabel?: string;
  /** Hardware sink and unit of the stored number. */
  unit: string;
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

/** A named tune field beyond the first-class scalars and tables: baseband words, tracking filters, test channels... */
export interface AtD890CalNamedField extends FieldBase {
  kind: AtD890CalFieldKind;
  length: number;
  byteOrder: AtD890CalFieldOrder;
  encoding: string;
  /** Unsigned value for a one- or two-byte integer field only; `undefined` otherwise or when not fully captured. */
  value: number | undefined;
}

/** A run of bytes no code ever loads: shown as unused (no reader), and erased by every tune rewrite. */
export interface AtD890CalUnusedRange {
  offset: number;
  /** Exclusive end offset. */
  end: number;
  availability: AtD890CalAvailability;
}

export interface AtD890Calibration {
  availability: AtD890CalAvailability;
  capturedLength: number;
  scalars: readonly AtD890CalScalar[];
  tables: readonly AtD890CalTable[];
  /** Other named loaded bytes (consumers, and loaded-but-unread bytes). */
  fields: readonly AtD890CalNamedField[];
  /** Bytes the firmware never loads. */
  unused: readonly AtD890CalUnusedRange[];
}

const TRIM_SOURCE: AtD890CalSource = {
  consumers: ['0x08047E10', '0x08116674', '0x08122974', '0x08060240'],
  note: 'Applied to every RF-chip frequency word: f′ = f ± f·|v − 2000| / 46,015,500 (v above 2000 raises, below lowers); factory editor 0–4000. 1 step ≈ 0.0217 ppm.',
};
const UHF_PA_SOURCE: AtD890CalSource = {
  consumers: ['0x0811A75C', '0x0803AAF8', '0x0801694C'],
  note: 'UHF APC reference for one power selection: DAC = (ref + T[i] − T[40]) × 16, 12-bit, written with HAL_DAC_SetValue on channel 1. Watts are unknown (bench only).',
};
const VHF_PA_SOURCE: AtD890CalSource = {
  consumers: ['0x0811A75C', '0x0803AAF8', '0x0801694C'],
  note: 'VHF/220 APC reference for one power selection (220 MHz always uses Low): DAC = (ref + T[i] − T[9]) × 16. Watts are unknown (bench only).',
};
const SQUELCH_SOURCE: AtD890CalSource = {
  consumers: ['0x080E373C', '0x0803C558'],
  note: 'Squelch reference captured as a 4-read RSSI average at the factory squelch level; used by 0x080E373C into reg 0x49. dBm are unknown.',
};
const METER_SOURCE: AtD890CalSource = {
  consumers: ['0x080CF7D8', '0x080CFFBC', '0x080CF2E0', '0x080CF3F4', '0x08049E3C'],
  note: 'Meter reference (first bar): one RSSI read at the factory reference level. dBm are unknown.',
};
const POWER_SOURCE: AtD890CalSource = {
  consumers: ['0x0811A75C', '0x0803AAF8', '0x0801694C'],
  note: 'Power-flatness table: DAC = (ref + T[index] − T[reference index]) × 16. Discrete lookup, no interpolation. Tier reductions: 200–300 MHz forces Low, repeater mode drops Turbo to High, TX Pow AGC (settings +0x10C) drops one tier. Watts are unknown.',
};
const FLATNESS_SOURCE: AtD890CalSource = {
  consumers: ['0x080E373C'],
  note: 'Squelch flatness: threshold += T[reference index] − T[index]; differences can be negative. Raw RSSI counts, dBm unknown.',
};

const RSSI_UNIT = 'raw RSSI count (RF reg 0x02 b9:0, 0–1023)';
const DAC1_UNIT = 'MCU DAC1 (APC / PA bias) code ÷ 16: DAC = value × 16';
const UHF_POWER_RULE = 'index = floor(f − 400); reference index 40 (440 MHz)';
const VHF_POWER_RULE =
  'index = floor(f − 136) below 174.00001 MHz, otherwise floor(f − 220) + 39; reference index 9 (145 MHz)';
const UHF_FLAT_RULE = 'index = floor((f − 400) / 5); reference index 8';
const VHF_FLAT_RULE = 'index = floor((f − 136) / 2); reference index 5; 220 MHz uses index 20';

function availabilityOf(offset: number, width: number, captured: number): AtD890CalAvailability {
  if (captured <= offset) return 'not-captured';
  return captured >= offset + width ? 'captured' : 'partial';
}

/** Little-endian u16 / u8: only valid for the LE regions (+0x000-+0x2FF, +0x1810-+0x181B, +0x1C00). */
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
    byteOrder: def.width === 1 ? 'single-byte' : 'little-endian',
    layout: 'traced',
    meaning: 'traced',
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
    meaning: 'traced',
  };
}

function namedField(bytes: Uint8Array, def: AtD890CalFieldDef): AtD890CalNamedField {
  const raw = bytes.slice(def.offset, def.offset + def.length);
  const availability = availabilityOf(def.offset, def.length, bytes.length);
  const integer = def.kind === 'field' && (def.length === 1 || def.length === 2);
  let value: number | undefined;
  if (integer && availability === 'captured') {
    if (def.length === 1) value = raw[0];
    else if (def.byteOrder === 'big-endian') value = (raw[0]! << 8) | raw[1]!;
    else if (def.byteOrder === 'little-endian') value = raw[0]! | (raw[1]! << 8);
  }
  const unused = def.kind !== 'field';
  return {
    id: def.id,
    label: def.label,
    offset: def.offset,
    raw,
    availability,
    layout: 'traced',
    meaning: def.inferred ? 'partially-traced' : 'traced',
    source: {
      consumers: [def.evidence],
      note: def.meaning + (unused ? ' (unused: no reader)' : ''),
    },
    ...(def.factoryLabel === undefined ? {} : { factoryLabel: def.factoryLabel }),
    unit: def.unit,
    kind: def.kind,
    length: def.length,
    byteOrder: def.byteOrder,
    encoding: def.encoding,
    value,
  };
}

const SELECTIONS = [0, 1, 2, 3] as const;
const UHF_PA_LABELS = ['PASU (0x10)', 'PALU (0x0F)', 'PAMU (0x0E)', 'PAHU (0x0D)'] as const;
const VHF_PA_LABELS = ['PASV (0x30)', 'PALV (0x2F)', 'PAMV (0x2E)', 'PAHV (0x2D)'] as const;

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
    unit: string,
    factoryLabel: string,
  ) => scalar(data, { id, label, offset, width, group, source, unit, factoryLabel });
  const scalars: AtD890CalScalar[] = [
    s(
      'trim',
      'Oscillator trim',
      0x000,
      2,
      'trim',
      TRIM_SOURCE,
      '1 step = f / 46,015,500 ≈ 0.0217 ppm (≈ 9.6 Hz at 440 MHz); neutral 2000',
      'FQCA (0x0C)',
    ),
    ...SELECTIONS.map((n) =>
      s(
        `uhf-power-ref-${n}`,
        `UHF power reference, ${AT_D890_POWER_TIERS[n]}`,
        0x002 + n,
        1,
        'power-reference',
        UHF_PA_SOURCE,
        DAC1_UNIT,
        UHF_PA_LABELS[n],
      ),
    ),
    ...SELECTIONS.map((n) =>
      s(
        `vhf-power-ref-${n}`,
        `VHF/220 power reference, ${AT_D890_POWER_TIERS[n]}`,
        0x102 + n,
        1,
        'power-reference',
        VHF_PA_SOURCE,
        DAC1_UNIT,
        VHF_PA_LABELS[n],
      ),
    ),
    ...(
      [
        [
          'uhf',
          'UHF',
          0x010,
          0x014,
          ['SQTHU (0x1D)', 'SQTHUB (0x1E)', 'RSSIUA (0x1F)', 'RSSIUB (0x20)'],
        ],
        [
          'vhf',
          'VHF',
          0x116,
          0x11a,
          ['SQTHV1A (0x36)', 'SQTHV1B (0x37)', 'RSSIV1A (0x3A)', 'RSSIV1B (0x3B)'],
        ],
        [
          '220',
          '220',
          0x124,
          0x128,
          ['SQTHV2A (0x38)', 'SQTHV2B (0x39)', 'RSSIV2A (0x3C)', 'RSSIV2B (0x3D)'],
        ],
      ] as const
    ).flatMap(([id, band, sq, meter, f]) => [
      s(
        `${id}-squelch-main`,
        `${band} squelch reference, main`,
        sq,
        2,
        'squelch',
        SQUELCH_SOURCE,
        RSSI_UNIT,
        f[0],
      ),
      s(
        `${id}-squelch-sub`,
        `${band} squelch reference, sub`,
        sq + 2,
        2,
        'squelch',
        SQUELCH_SOURCE,
        RSSI_UNIT,
        f[1],
      ),
      s(
        `${id}-meter-main`,
        `${band} meter reference, main`,
        meter,
        2,
        'meter',
        METER_SOURCE,
        RSSI_UNIT,
        f[2],
      ),
      s(
        `${id}-meter-sub`,
        `${band} meter reference, sub`,
        meter + 2,
        2,
        'meter',
        METER_SOURCE,
        RSSI_UNIT,
        f[3],
      ),
    ]),
  ];
  const tables: AtD890CalTable[] = [
    ...SELECTIONS.map((n) =>
      table(data, {
        id: `uhf-power-${n}`,
        label: `UHF power table, ${AT_D890_POWER_TIERS[n]}`,
        group: 'power',
        band: 'uhf',
        selection: n,
        offset: 0xc00 + n * 0x100,
        length: 121,
        referenceIndex: 40,
        indexRule: UHF_POWER_RULE,
        source: POWER_SOURCE,
        unit: DAC1_UNIT + ' (per-entry offset, 1 MHz steps 400–520)',
      }),
    ),
    ...SELECTIONS.map((n) =>
      table(data, {
        id: `vhf-power-${n}`,
        label: `VHF/220 power table, ${AT_D890_POWER_TIERS[n]}`,
        group: 'power',
        band: 'vhf-220',
        selection: n,
        offset: 0x1000 + n * 0x100,
        length: 45,
        referenceIndex: 9,
        indexRule: VHF_POWER_RULE,
        source: POWER_SOURCE,
        unit: DAC1_UNIT + ' (per-entry offset, 1 MHz steps)',
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
        unit: 'raw RSSI count offset',
      }),
    ),
  ];
  const fields = AT_D890_CAL_FIELD_DEFS.map((def) => namedField(data, def));
  const loaded = [
    ...scalars.map((f) => [f.offset, f.offset + f.width] as const),
    ...tables.map((t) => [t.offset, t.offset + t.length] as const),
    ...fields.map((f) => [f.offset, f.offset + f.length] as const),
  ].sort((a, b) => a[0] - b[0]);
  const unused: AtD890CalUnusedRange[] = [];
  let cursor = 0;
  const pushUnused = (start: number, end: number) => {
    if (end <= start) return;
    unused.push({
      offset: start,
      end,
      availability: availabilityOf(start, end - start, data.length),
    });
  };
  for (const [start, end] of loaded) {
    pushUnused(cursor, start);
    cursor = Math.max(cursor, end);
  }
  pushUnused(cursor, AT_D890_TUNE_UNIT_BYTES);
  return {
    availability:
      data.length === 0 ? 'not-captured' : availabilityOf(0, AT_D890_TUNE_UNIT_BYTES, data.length),
    capturedLength: data.length,
    scalars,
    tables,
    fields,
    unused,
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
