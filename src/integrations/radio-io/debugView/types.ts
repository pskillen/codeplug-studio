/**
 * Radio-neutral view models for the debug pages. A radio home
 * (`integrations/radio-io/radios/<radio>/`) builds them from an archive; the kit components in
 * `src/app/components/debug/` only draw them. Pure data: no React, no radio literals.
 */

/** One read's calibration, as drawn. Built by a radio home from an archive; never React. */
export interface CalibrationView {
  status: { kind: 'ok' } | { kind: 'not-captured' | 'refused'; reason: string };
  /** Shown once at the top: the "not validated on hardware" notice and the layout basis. */
  notice?: EvidenceNoticeView;
  /** Facts about the region read: address, captured length, basis firmware. */
  facts?: readonly { label: string; value: string }[];
  charts: readonly CalibrationChart[];
  tables: readonly ValueTableView[];
  unused?: readonly UnusedRange[];
  hex: readonly HexSource[];
}

/**
 * How a number is printed (owner rule, decision 88): `hex-dec` (`0x1A (26)`) only for raw bytes,
 * enums and codes; `decimal` (with a unit) for counts, frequencies and physical values; `hex`
 * alone for addresses.
 */
export type NumberFormat = 'hex-dec' | 'decimal' | 'hex';

export type Confidence = 'traced' | 'partially-traced' | 'inferred' | 'unknown' | 'unused';

interface ChartBase {
  id: string; // stable across reads: the overlay pairs charts and series by id
  title: string; // "VHF power, 136–174 MHz"
  meaning: string; // one line: "PA drive the radio uses at each MHz, per power level."
  about?: string; // the long text: index rule, sources, caveats
  address?: string; // "0x3CC0–0x3D3F", shown as code beside the title
  confidence?: { layout: Confidence; meaning: Confidence };
  table: NumericTableView; // the Numeric table folded inside the card
}
export interface FrequencyCurve extends ChartBase {
  kind: 'frequency-curve';
  x: { label: string; unit: 'MHz' };
  y: { label: string; unit: string; domain?: readonly [number, number] };
  series: readonly {
    id: string;
    label: string;
    slot: number;
    points: readonly { x: number; y: number }[];
  }[];
  /** True when the radio looks entries up discretely: the card says lines are a guide only. */
  discrete?: boolean;
}
export interface StepBars extends ChartBase {
  kind: 'step-bars';
  x: { label: string }; // "Squelch level", "S-meter step", "MHz"
  y: { label: string; unit: string; domain?: 'auto' | readonly [number, number] };
  bars: readonly { id: string; label: string; value: number | undefined }[];
}
export interface BatteryLadder extends ChartBase {
  kind: 'battery';
  steps: readonly { id: string; label: string; raw: number | undefined; volts?: number }[];
  blank?: string; // "All six read 0xFF: the firmware uses built-in thresholds"
}
export interface TrimView extends ChartBase {
  kind: 'trim';
  raw: number | undefined;
  scale: { min: number; max: number; neutral?: number };
  /** Absent: the ppm scale is unknown and the display says so. */
  ppm?: { perStep: number; span?: number };
  outOfRange?: string; // "Above 16 the firmware uses index 8 (0 ppm)"
}
export type CalibrationChart = FrequencyCurve | StepBars | BatteryLadder | TrimView;

export interface NumericTableView {
  /** Row key column: "Index", "MHz", "Level". */
  key: { label: string };
  rows: readonly { key: string; mark?: 'reference' }[];
  columns: readonly {
    id: string;
    label: string;
    values: readonly (number | undefined)[]; // undefined = not captured
    width: 1 | 2; // bytes, for hex padding
    /** How each cell prints. Default `hex-dec`: right for raw bytes and codes only. */
    format?: NumberFormat;
    deltaFromRow?: number; // index of the reference row: adds Δref
  }[];
}

export interface ValueTableView {
  id: string;
  title: string;
  description?: string;
  /** "single": one Value column. "bands": one Value column per band, rows paired by meaning. */
  layout: 'single' | { bands: readonly string[] };
  rows: readonly ValueRow[];
}
export interface ValueRow {
  id: string;
  label: string;
  group?: string; // dimmed under the label
  address?: string; // absolute or "+0x040"
  /** One cell per band in a band layout, else one. */
  cells: readonly {
    raw?: Uint8Array; // shown hex; numbers also decimal
    value?: number; // unsigned value when the field is an integer
    decoded?: string; // "V1.61", "145.50000 MHz", "Always on"
    unit?: string;
    /** How an integer `value` prints. Default `hex-dec`: right for raw bytes, enums and codes only. */
    format?: NumberFormat;
    availability: 'captured' | 'partial' | 'not-captured';
    sensitive?: boolean; // masked until Show password
  }[];
  confidence?: { layout: Confidence; meaning: Confidence };
  source?: string;
  note?: string;
}
export interface UnusedRange {
  start: string;
  end: string;
  bytes: number;
  why: string;
}
export interface HexSource {
  id: string;
  label: string;
  address: number;
  bytes: Uint8Array;
  sensitive?: readonly { start: number; length: number }[];
}
export interface EvidenceNoticeView {
  title: string;
  lines: readonly string[];
  tone: 'caution' | 'info';
}

/** One read's settings, as drawn. */
export interface SettingsView {
  status: { kind: 'ok' } | { kind: 'not-captured' | 'ambiguous'; reason: string };
  summary: string; // "118 of 118 known setting fields captured · 113 decoded · …"
  intro: string;
  groups: readonly { id: string; label: string; rows: readonly SettingRow[] }[];
  trailing?: readonly { id: string; title: string; rows: readonly SettingRow[] }[]; // documented-not-decoded, unused, unknown
}
export interface SettingRow {
  id: string;
  label: string;
  help?: string; // includes the encoding ("0 OFF, 1–9")
  value: string | undefined; // undefined = Not captured
  rawValue?: number; // shown as "(26)" only when value is not a number already
  firmwareDefault?: string; // optional column, shown when any row in the view has one
  confidence: Confidence;
  evidence?: string;
  address?: string; // raw toggle
  raw?: readonly number[]; // raw toggle, hex
  sensitive?: boolean;
}
