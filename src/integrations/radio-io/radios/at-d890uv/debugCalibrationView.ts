/**
 * The AT-D890UV Calibration tab as a radio-neutral `CalibrationView`, built from the static decode in
 * `core/radios/anytone/at-d890uv/calibration.ts` over the live tune unit (`vital-tune-a`). Every
 * address, index rule and caveat the page shows is here; the shared tab and kit components only
 * draw it. Read-only: nothing here edits, rereads or ends a session with the radio.
 */
import {
  AT_D890_POWER_TIERS,
  AT_D890_TRIM_EDITOR_BOUNDS,
  AT_D890_TRIM_NEUTRAL,
  AT_D890_TRIM_PPM_PER_STEP,
  AT_D890_TUNE_UNIT_BYTES,
  decodeAtD890Calibration,
  type AtD890CalConfidence,
  type AtD890CalNamedField,
  type AtD890CalScalar,
  type AtD890CalTable,
} from '@core/radios/anytone/at-d890uv/calibration.ts';
import type { RadioBackupManifestV1 } from '../../backup/types.ts';
import type {
  CalibrationChart,
  CalibrationView,
  Confidence,
  FrequencyCurve,
  NumericTableView,
  TrimView,
  UnusedRange,
  ValueRow,
  ValueTableView,
} from '../../debugView/index.ts';
import { AT_D890UV_MODEL_IDS } from './constants.ts';
import { AT_D890_VITAL_UNIT_BYTES, AT_D890_VITAL_UNITS } from './vitalBackup.ts';

const TUNE_A = AT_D890_VITAL_UNITS.find((unit) => unit.id === 'tune-a')!;
const TUNE_B = AT_D890_VITAL_UNITS.find((unit) => unit.id === 'tune-b')!;

/** What the view needs of an archive: the manifest, the stored region bytes and where it came from. */
export interface AtD890CalibrationArchive {
  manifest: Pick<RadioBackupManifestV1, 'radioModelId' | 'regions'>;
  regions: Readonly<Record<string, Uint8Array>>;
  source?: 'file' | 'live-read';
}

export type AtD890TuneSelection =
  | { status: 'not-captured'; aliasPresent: boolean }
  | { status: 'refused'; reason: string }
  | { status: 'ok'; address: number; bytes: Uint8Array };

const hexAddress = (n: number) => `0x${n.toString(16).toUpperCase().padStart(8, '0')}`;
const offsetText = (n: number) => `+0x${n.toString(16).toUpperCase().padStart(3, '0')}`;
const count = (n: number) => n.toLocaleString('en-GB');

/**
 * Pick the live tune unit only: AT-D890UV `vital-tune-a` at its requested address, inspect-only, with manifest length
 * equal to the stored bytes and within one unit. Never falls back to tune-b (it can alias LocalInfo) or to labels.
 */
export function selectAtD890TuneRegion(
  archive: AtD890CalibrationArchive | undefined,
): AtD890TuneSelection {
  if (!archive) return { status: 'not-captured', aliasPresent: false };
  if (archive.manifest.radioModelId !== AT_D890UV_MODEL_IDS[0])
    return { status: 'refused', reason: 'Archive is not an AT-D890UV capture.' };
  const entries = archive.manifest.regions.filter((r) => r.id === `vital-${TUNE_A.id}`);
  const aliasPresent = archive.manifest.regions.some((r) => r.id === `vital-${TUNE_B.id}`);
  if (entries.length === 0) return { status: 'not-captured', aliasPresent };
  if (entries.length > 1)
    return { status: 'refused', reason: 'Archive lists the live tune unit more than once.' };
  const region = entries[0]!;
  const bytes = archive.regions[region.id];
  if (region.address !== TUNE_A.address)
    return {
      status: 'refused',
      reason: `Live tune unit is recorded at ${hexAddress(region.address)}, not the requested ${hexAddress(TUNE_A.address)}.`,
    };
  if (region.restoreRole !== 'inspect-only')
    return { status: 'refused', reason: 'Live tune unit is not marked inspect-only.' };
  if (!bytes || bytes.length !== region.byteLength)
    return { status: 'refused', reason: 'Manifest length does not match the stored tune bytes.' };
  if (region.byteLength > AT_D890_VITAL_UNIT_BYTES)
    return { status: 'refused', reason: 'Live tune unit is larger than one 256 KiB unit.' };
  return { status: 'ok', address: region.address, bytes };
}

const NOTICE = {
  title: 'Not validated on hardware',
  tone: 'caution' as const,
  lines: [
    'Field offsets and arithmetic come from a static trace of V1.05 firmware; the running firmware is not identified, so they may not apply. Firmware may divert the requested address. Agreement between repeated reads shows a stable read, not valid calibration.',
    'Units are the hardware codes the firmware uses; watts, dBm and Hz of deviation are unknown (bench measurement only). No limits or health verdicts are given. Source: radio repo PR #245 (F349–F356).',
  ],
};

const BYTE_ORDER_FACT =
  'Little-endian in +0x000–+0x2FF, +0x1810–+0x181B, +0x1C00; big-endian in +0x300–+0x6FF and +0x1800–+0x180F';

const ORDER_TEXT = {
  'single-byte': 'u8',
  'little-endian': 'u16 little-endian',
  'big-endian': 'u16 big-endian',
  bytes: 'bytes',
} as const;

const AVAILABILITY_TEXT = {
  captured: 'complete',
  partial: 'partly captured',
  'not-captured': 'not captured',
} as const;

function notCaptured(reason: string): CalibrationView {
  return { status: { kind: 'not-captured', reason }, charts: [], tables: [], hex: [] };
}

const confidence = (c: AtD890CalConfidence): Confidence => c;

const TIER_IDS = AT_D890_POWER_TIERS.map((t) => t.toLowerCase());

type Point = { x: number; y: number };
const GAP = Number.NaN;

/** One table as chart points: a missing entry or a jump in frequency is a gap (NaN), never bridged. */
function pointsOf(table: AtD890CalTable, xs: readonly (number | undefined)[]): Point[] {
  const out: Point[] = [];
  let previousX: number | undefined;
  xs.forEach((x, i) => {
    if (x === undefined) return;
    if (previousX !== undefined && x - previousX > 5) out.push({ x: (previousX + x) / 2, y: GAP });
    const y = table.values[i];
    out.push({ x, y: y === undefined ? GAP : y });
    previousX = x;
  });
  return out.some((p) => Number.isFinite(p.y)) ? out : [];
}

interface CurveSpec {
  id: string;
  title: string;
  meaning: string;
  about: string;
  yUnit: string;
  tables: readonly AtD890CalTable[];
  seriesIds: readonly string[];
  seriesLabels: readonly string[];
  /** MHz of each table index; indexes the rule does not address are left out. */
  xOf: (index: number) => number | undefined;
}

function curve(spec: CurveSpec): FrequencyCurve | undefined {
  const first = spec.tables[0]!;
  const xs = Array.from({ length: first.length }, (_, i) => spec.xOf(i));
  const series = spec.tables.flatMap((t, slot) => {
    const points = pointsOf(t, xs);
    return points.length
      ? [{ id: spec.seriesIds[slot]!, label: spec.seriesLabels[slot]!, slot, points }]
      : [];
  });
  if (!series.length) return undefined;
  const indexes = xs.flatMap((x, i) => (x === undefined ? [] : [i]));
  const table: NumericTableView = {
    key: { label: 'MHz' },
    rows: indexes.map((i) => ({
      key: String(xs[i]),
      ...(i === first.referenceIndex ? { mark: 'reference' as const } : {}),
    })),
    columns: spec.tables.map((t, slot) => ({
      id: spec.seriesIds[slot]!,
      label: spec.seriesLabels[slot]!,
      values: indexes.map((i) => t.values[i]),
      width: 1 as const,
      deltaFromRow: indexes.indexOf(first.referenceIndex),
    })),
  };
  const last = spec.tables.at(-1)!;
  return {
    id: spec.id,
    kind: 'frequency-curve',
    title: spec.title,
    meaning: spec.meaning,
    about: spec.about,
    address: `${offsetText(first.offset)}–${offsetText(last.offset + last.length - 1)}`,
    confidence: { layout: confidence(first.layout), meaning: confidence(first.meaning) },
    x: { label: 'Frequency', unit: 'MHz' },
    y: { label: 'Table entry', unit: spec.yUnit },
    series,
    table,
    discrete: true,
  };
}

const sourceText = (s: { consumers: readonly string[]; note: string }) =>
  `Sources: ${s.consumers.join(', ')}. ${s.note}`;

const GUIDE =
  'Lines join neighbouring captured entries as a visual guide only; the firmware looks up one discrete entry and does not interpolate. Missing entries are gaps.';

function powerCharts(tables: readonly AtD890CalTable[]): (FrequencyCurve | undefined)[] {
  const power = (band: AtD890CalTable['band']) =>
    tables.filter((t) => t.group === 'power' && t.band === band);
  const uhf = power('uhf');
  const vhf = power('vhf-220');
  const common = { yUnit: 'DAC code ÷ 16', seriesIds: TIER_IDS, seriesLabels: AT_D890_POWER_TIERS };
  return [
    uhf.length
      ? curve({
          ...common,
          id: 'power-uhf',
          title: 'UHF power, 400–520 MHz',
          meaning: 'Per-MHz offset the radio adds to the PA reference, per power level.',
          about:
            `Four tables of ${uhf[0]!.length} entries, one per power level (Low, Mid, High, Turbo; slots 0–3). ` +
            `Index rule: ${uhf[0]!.indexRule}. ${sourceText(uhf[0]!.source)} Unit: ${uhf[0]!.unit}. ${GUIDE}`,
          tables: uhf,
          xOf: (i) => 400 + i,
        })
      : undefined,
    vhf.length
      ? curve({
          ...common,
          id: 'power-vhf-220',
          title: 'VHF and 220 power, 136–174 and 220–225 MHz',
          meaning: 'Per-MHz offset the radio adds to the PA reference, per power level.',
          about:
            `Four tables of ${vhf[0]!.length} entries, one per power level (Low, Mid, High, Turbo; slots 0–3). ` +
            `Index rule: ${vhf[0]!.indexRule}; 220 MHz always uses Low. ${sourceText(vhf[0]!.source)} Unit: ${vhf[0]!.unit}. ${GUIDE} The break between 174 and 220 MHz is the index rule, not a missing read.`,
          tables: vhf,
          xOf: (i) => (i < 39 ? 136 + i : 220 + (i - 39)),
        })
      : undefined,
  ];
}

function flatnessCharts(tables: readonly AtD890CalTable[]): (FrequencyCurve | undefined)[] {
  const flat = (band: AtD890CalTable['band']) =>
    ['main', 'sub'].flatMap((path) =>
      tables.filter((t) => t.group === 'flatness' && t.band === band && t.path === path),
    );
  const uhf = flat('uhf');
  const vhf = flat('vhf-220');
  const common = {
    yUnit: 'raw RSSI count offset',
    seriesIds: ['main', 'sub'],
    seriesLabels: ['Main', 'Sub'],
  };
  return [
    uhf.length
      ? curve({
          ...common,
          id: 'squelch-flatness-uhf',
          title: 'UHF squelch flatness, 400–520 MHz',
          meaning: 'How the squelch threshold shifts across the band, main and sub receiver.',
          about:
            `Two tables of ${uhf[0]!.length} entries, main (slot 0) and sub (slot 1). Index rule: ${uhf[0]!.indexRule}. ` +
            `${sourceText(uhf[0]!.source)} ${GUIDE}`,
          tables: uhf,
          xOf: (i) => 400 + i * 5,
        })
      : undefined,
    vhf.length
      ? curve({
          ...common,
          id: 'squelch-flatness-vhf-220',
          title: 'VHF and 220 squelch flatness, 136–174 and 220 MHz',
          meaning: 'How the squelch threshold shifts across the band, main and sub receiver.',
          about:
            `Two tables of ${vhf[0]!.length} entries, main (slot 0) and sub (slot 1). Index rule: ${vhf[0]!.indexRule}. ` +
            'Entries 21–24 are not addressed by that rule, so they are not drawn; they stay in the raw bytes. ' +
            `${sourceText(vhf[0]!.source)} ${GUIDE}`,
          tables: vhf,
          xOf: (i) => (i <= 19 ? 136 + i * 2 : i === 20 ? 220 : undefined),
        })
      : undefined,
  ];
}

function trimChart(trim: AtD890CalScalar | undefined): TrimView | undefined {
  if (!trim || trim.availability === 'not-captured') return undefined;
  const [min, max] = AT_D890_TRIM_EDITOR_BOUNDS;
  const raw = trim.value;
  return {
    id: 'trim',
    kind: 'trim',
    title: 'Oscillator trim',
    meaning: `Shifts every RF frequency; neutral is ${AT_D890_TRIM_NEUTRAL}, a higher value raises it.`,
    about:
      `${sourceText(trim.source)} Neutral ${AT_D890_TRIM_NEUTRAL}; one step is ${AT_D890_TRIM_PPM_PER_STEP.toFixed(4)} ppm. ` +
      `The factory editor allows ${min}–${max}; those bounds are evidence of the editor, not validated RF limits. ` +
      `Stored as a ${ORDER_TEXT[trim.byteOrder]} word; factory label ${trim.factoryLabel}.`,
    address: offsetText(trim.offset),
    confidence: { layout: confidence(trim.layout), meaning: confidence(trim.meaning) },
    raw,
    scale: { min, max, neutral: AT_D890_TRIM_NEUTRAL },
    ppm: { perStep: AT_D890_TRIM_PPM_PER_STEP },
    table: {
      key: { label: 'Field' },
      rows: [{ key: 'Oscillator trim' }],
      columns: [{ id: 'raw', label: 'Raw', values: [raw], width: 2, format: 'decimal' }],
    },
  };
}

type Cell = ValueRow['cells'][number];

function scalarCell(s: AtD890CalScalar | undefined, format?: Cell['format']): Cell {
  if (!s || s.availability === 'not-captured') return { availability: 'not-captured' };
  return {
    raw: s.raw,
    ...(s.value === undefined ? {} : { value: s.value }),
    ...(format ? { format } : {}),
    availability: s.availability,
  };
}

function scalarRow(
  id: string,
  label: string,
  scalars: readonly (AtD890CalScalar | undefined)[],
  format?: Cell['format'],
): ValueRow {
  const present = scalars.filter((s): s is AtD890CalScalar => s !== undefined);
  const first = present[0];
  const group = present
    .map((s) => s.factoryLabel)
    .filter(Boolean)
    .join(' · ');
  return {
    id,
    label,
    ...(group ? { group } : {}),
    address: scalars.map((s) => (s ? offsetText(s.offset) : '—')).join(' / '),
    cells: scalars.map((s) => scalarCell(s, format)),
    ...(first
      ? {
          confidence: { layout: confidence(first.layout), meaning: confidence(first.meaning) },
          source: first.source.consumers.join(', '),
          note: `${first.unit}. ${first.source.note}`,
        }
      : {}),
  };
}

function fieldRow(f: AtD890CalNamedField): ValueRow {
  const order = f.kind === 'field' ? ORDER_TEXT[f.byteOrder] : undefined;
  return {
    id: f.id,
    label: f.label,
    ...(f.factoryLabel ? { group: f.factoryLabel } : {}),
    address: f.length > 1 ? `${offsetText(f.offset)} +${f.length}` : offsetText(f.offset),
    cells: [
      f.availability === 'not-captured'
        ? { availability: 'not-captured' }
        : {
            raw: f.raw,
            ...(f.value === undefined ? {} : { value: f.value }),
            availability: f.availability,
          },
    ],
    confidence: { layout: confidence(f.layout), meaning: confidence(f.meaning) },
    source: f.source.consumers.join(', '),
    note: [order, f.encoding, f.unit && `Unit: ${f.unit}`, f.source.note]
      .filter(Boolean)
      .join(' · '),
  };
}

const RSSI_BANDS = [
  ['uhf', 'UHF'],
  ['vhf', 'VHF'],
  ['220', '220'],
] as const;

function referenceTables(scalars: readonly AtD890CalScalar[]): ValueTableView[] {
  const byId = (id: string) => scalars.find((s) => s.id === id);
  const rssi = (kind: 'squelch' | 'meter', title: string, description: string): ValueTableView => ({
    id: `${kind}-references`,
    title,
    description,
    layout: { bands: RSSI_BANDS.map(([, label]) => label) },
    rows: (['main', 'sub'] as const).map((path) =>
      scalarRow(
        `${kind}-${path}`,
        `${kind === 'squelch' ? 'Squelch' : 'Meter'} reference, ${path}`,
        RSSI_BANDS.map(([id]) => byId(`${id}-${kind}-${path}`)),
        'decimal',
      ),
    ),
  });
  return [
    {
      id: 'power-references',
      title: 'Power references',
      description:
        'The APC reference for each power level, before the per-MHz table entry is added: DAC = (reference + entry − entry at the reference index) × 16. Watts are unknown.',
      layout: { bands: ['UHF', 'VHF/220'] },
      rows: AT_D890_POWER_TIERS.map((tier, n) =>
        scalarRow(`power-ref-${n}`, `${tier} (selection ${n})`, [
          byId(`uhf-power-ref-${n}`),
          byId(`vhf-power-ref-${n}`),
        ]),
      ),
    },
    rssi(
      'squelch',
      'Squelch references',
      'Raw RSSI counts (0–1023) captured at the factory squelch level, main and sub receiver. dBm are unknown.',
    ),
    rssi(
      'meter',
      'Meter references',
      'Raw RSSI counts (0–1023) captured at the factory reference level for the first meter bar, main and sub receiver. dBm are unknown.',
    ),
  ];
}

function unusedRanges(ranges: readonly { offset: number; end: number }[]): UnusedRange[] {
  return ranges.map((r) => ({
    start: offsetText(r.offset),
    end: offsetText(r.end - 1),
    bytes: r.end - r.offset,
    why: 'No firmware code loads these bytes; every tune rewrite erases them.',
  }));
}

/** Calibration view for an AT-D890UV archive; "not captured" or "refused" when the tune unit is not usable. */
export function atD890CalibrationView(archive: AtD890CalibrationArchive): CalibrationView {
  const selection = selectAtD890TuneRegion(archive);
  if (selection.status === 'refused')
    return {
      status: {
        kind: 'refused',
        reason: `${selection.reason} No other region is decoded in its place.`,
      },
      charts: [],
      tables: [],
      hex: [],
    };
  if (selection.status === 'not-captured')
    return notCaptured(
      `This archive has no live tune unit (${hexAddress(TUNE_A.address)}).` +
        (selection.aliasPresent
          ? ' Calibration B (as returned) is present but is not used: the radio can answer that address with LocalInfo.'
          : ''),
    );
  const cal = decodeAtD890Calibration(selection.bytes);
  const named = cal.fields.filter((f) => f.kind === 'field');
  const unread = cal.fields.filter((f) => f.kind !== 'field');
  const fieldBytes = (items: readonly AtD890CalNamedField[]) =>
    items.reduce((n, f) => n + f.length, 0);
  const unusedBytes = cal.unused.reduce((n, r) => n + r.end - r.offset, 0);

  const charts: CalibrationChart[] = [
    ...powerCharts(cal.tables),
    ...flatnessCharts(cal.tables),
    trimChart(cal.scalars.find((s) => s.group === 'trim')),
  ].filter((c) => c !== undefined);

  const tables: ValueTableView[] = [
    ...referenceTables(cal.scalars),
    {
      id: 'other-fields',
      title: 'Other loaded fields',
      description: `${count(fieldBytes(named))} bytes with a firmware consumer: tuning, tracking filters, baseband words, test channels and the second board. Multi-word blocks show raw bytes only; big-endian regions are never decoded with the little-endian helper.`,
      layout: 'single',
      folded: true,
      rows: named.map(fieldRow),
    },
    {
      id: 'loaded-no-reader',
      title: 'Loaded, no reader',
      description: `${count(fieldBytes(unread))} bytes the radio loads (or the defaults writer fills) but no code reads. Shown as unused (no reader), not unknown.`,
      layout: 'single',
      folded: true,
      rows: unread.map(fieldRow),
    },
  ];

  return {
    status: { kind: 'ok' },
    notice: NOTICE,
    facts: [
      { label: 'Region', value: `Calibration (live) · ${hexAddress(selection.address)}` },
      {
        label: 'Captured',
        value: `${count(cal.capturedLength)} of ${count(AT_D890_TUNE_UNIT_BYTES)} bytes (${AVAILABILITY_TEXT[cal.availability]})`,
      },
      ...(archive.source
        ? [{ label: 'Source', value: archive.source === 'file' ? 'Local archive' : 'Live read' }]
        : []),
      { label: 'Layout basis', value: 'V1.05 static trace; running firmware unknown' },
      { label: 'Byte order', value: BYTE_ORDER_FACT },
      { label: 'Never read', value: `${count(unusedBytes)} bytes in ${cal.unused.length} ranges` },
    ],
    charts,
    tables,
    unused: unusedRanges(cal.unused),
    hex: [
      {
        id: 'tune',
        label: `Tune unit ${hexAddress(selection.address)} (every captured byte, including the unused ranges)`,
        address: selection.address,
        bytes: selection.bytes,
      },
    ],
  };
}
