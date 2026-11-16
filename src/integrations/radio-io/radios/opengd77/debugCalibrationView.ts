/**
 * The OpenGD77 (DM-1701 family, MD-9600) Calibration tab as a radio-neutral `CalibrationView`,
 * built from the 512-byte working-copy decode in `core/radios/opengd77/calibration.ts`. Every
 * address, index rule and caveat the page shows is here; the shared tab and kit components only
 * draw it. This is the OpenGD77 working copy, never stock factory calibration. Read-only: nothing
 * here edits or rereads the radio.
 */
import {
  OPENGD77_CALIBRATION_LENGTH,
  type OpenGd77CalibrationConfidence,
  type OpenGd77CalibrationRow,
} from '@core/radios/opengd77/calibration.ts';
import type {
  CalibrationChart,
  CalibrationView,
  Confidence,
  FrequencyCurve,
  HexSource,
  NumericTableView,
  TrimView,
  UnusedRange,
  ValueRow,
  ValueTableView,
} from '../../debugView/index.ts';
import type { RadioBackupManifestV1 } from '../../backup/types.ts';
import { OPENGD77_CALIBRATION_ADDRESS } from './constants.ts';
import { selectOpenGd77Calibration } from './debugCalibration.ts';
import { openGd77DebugIdentity } from './debugCoverage.ts';

/** What the view needs of an archive. */
export interface OpenGd77CalibrationArchive {
  manifest: RadioBackupManifestV1;
  regions: Record<string, Uint8Array>;
  sidecars: Record<string, Uint8Array>;
}

const hexAbs = (offset: number) =>
  `0x${(OPENGD77_CALIBRATION_ADDRESS + offset).toString(16).toUpperCase().padStart(5, '0')}`;
const hexOff = (offset: number) => `0x${offset.toString(16).toUpperCase().padStart(3, '0')}`;
const count = (n: number) => n.toLocaleString('en-GB');
const REGION_LAST = OPENGD77_CALIBRATION_ADDRESS + OPENGD77_CALIBRATION_LENGTH - 1;

const BANDS = [
  { band: 'UHF', id: 'uhf', points: 9 },
  { band: 'VHF', id: 'vhf', points: 5 },
] as const;
type Band = (typeof BANDS)[number];

/** Squelch keeps a point index on x: the stock rows have no consumer and no stated frequency grid. */
const SQUELCH_INDEX_NOTE =
  'The x axis is the frequency point index (0 first), not MHz: these stock rows have no reader and no stated frequency grid, and the stock frequency-point table (UHF 0x1B0, VHF 0x100; encoding inferred) is the only record of which frequency each point is. On UHF its first point is overwritten by the OpenGD77 local marker.';

const gridNote = (what: string, grid: readonly number[], evidence: string) =>
  `The x axis is ${what} from the firmware's own lookup (${grid.join(', ')} MHz; ${evidence}), not the inferred stock frequency-point table.`;

function notCaptured(reason: string): CalibrationView {
  return { status: { kind: 'not-captured', reason }, charts: [], tables: [], hex: [] };
}

const meaningOf = (row: OpenGd77CalibrationRow): Confidence => {
  const m: OpenGd77CalibrationConfidence = row.meaningConfidence;
  if (m === 'traced') return row.hasReader ? 'traced' : 'unused';
  return m === 'partly' ? 'partially-traced' : 'unknown';
};

/** Watt-point suffix of a power row label: "High power (5 W point)" gives name "High", "5 W". */
function powerName(label: string): string {
  const m = /^(.*?) power \((.*) point\)$/.exec(label);
  return m ? `${m[1]} (${m[2]})` : label;
}

function bytes(row: OpenGd77CalibrationRow | undefined, points: number): (number | undefined)[] {
  return Array.from({ length: points }, (_, i) => (row ? row.raw[i] : undefined));
}

function pointTable(
  points: number,
  mhz: readonly number[] | undefined,
  columns: { id: string; label: string; row: OpenGd77CalibrationRow | undefined }[],
): NumericTableView {
  return {
    key: { label: mhz ? 'Point · MHz' : 'Point' },
    rows: Array.from({ length: points }, (_, i) => ({
      key: mhz ? `${i} · ${mhz[i]} MHz` : String(i),
    })),
    columns: columns.map((c) => ({
      id: c.id,
      label: c.label,
      values: bytes(c.row, points),
      width: 1 as const,
    })),
  };
}

function sourceText(rows: readonly (OpenGd77CalibrationRow | undefined)[]): string {
  const seen = new Set<string>();
  for (const r of rows) if (r) seen.add(`${r.unit}. Evidence: ${r.evidence}.`);
  return [...seen].join(' ');
}

function curve(
  b: Band,
  spec: {
    id: string;
    title: string;
    meaning: string;
    about: string;
    yLabel: string;
    series: { id: string; label: string; row: OpenGd77CalibrationRow | undefined }[];
    /** MHz of each point, with how it was traced; absent: x is the point index (squelch). */
    grid?: { mhz: readonly number[]; note: string };
  },
): FrequencyCurve | undefined {
  const present = spec.series.filter((s) => s.row);
  if (!present.length) return undefined;
  const rows = present.map((s) => s.row!);
  const first = rows[0]!;
  return {
    id: `${spec.id}-${b.id}`,
    kind: 'frequency-curve',
    title: `${b.band} ${spec.title}`,
    meaning: spec.meaning,
    about: `${spec.about} ${spec.grid?.note ?? SQUELCH_INDEX_NOTE} ${sourceText(rows)}`.trim(),
    address: `${hexAbs(Math.min(...rows.map((r) => r.offset)))}–${hexAbs(
      Math.max(...rows.map((r) => r.offset + r.length)) - 1,
    )}`,
    confidence: { layout: 'traced', meaning: meaningOf(first) },
    x: spec.grid
      ? { label: 'Frequency', unit: 'MHz' }
      : { label: `Frequency point number, 0–${b.points - 1}` },
    y: { label: spec.yLabel, unit: 'stored byte' },
    series: present.flatMap((s, slot) => {
      const points = Array.from(s.row!.raw, (y, i) => ({ x: spec.grid?.mhz[i] ?? i, y }));
      return points.length ? [{ id: s.id, label: s.label, slot, points }] : [];
    }),
    table: pointTable(
      b.points,
      spec.grid?.mhz,
      present.map((s) => ({ id: s.id, label: s.label, row: s.row })),
    ),
  };
}

function trimChart(b: Band, row: OpenGd77CalibrationRow | undefined): TrimView | undefined {
  if (!row) return undefined;
  const raw = row.raw[0];
  return {
    id: `trim-${b.id}`,
    kind: 'trim',
    title: `${b.band} oscillator tune`,
    meaning: 'Reference-oscillator trim written to the HR-C6000 (ppm scale unknown).',
    about:
      `Offset binary: signed trim = byte − 128, so 128 is neutral. ${row.consumer}. ` +
      `${row.note ? `${row.note} ` : ''}Evidence: ${row.evidence}. The ppm per step is not known.`,
    address: hexAbs(row.offset),
    confidence: { layout: 'traced', meaning: meaningOf(row) },
    raw,
    scale: { min: 0, max: 255, neutral: 128 },
    table: {
      key: { label: 'Field' },
      rows: [{ key: `${b.band} oscillator tune` }],
      columns: [{ id: 'raw', label: 'Raw', values: [raw], width: 1 }],
    },
  };
}

const decimalCell = (row: OpenGd77CalibrationRow): ValueRow['cells'][number] => ({
  raw: row.raw,
  ...(row.decoded === undefined ? {} : { decoded: row.decoded }),
  availability: 'captured',
});

function valueRow(row: OpenGd77CalibrationRow, partner?: OpenGd77CalibrationRow): ValueRow {
  const note = [
    row.unit ? `Unit: ${row.unit}` : '',
    row.hasReader ? `Used by: ${row.consumer}` : 'Not used by OpenGD77',
    row.note ?? '',
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    id: row.id.replace(/^(uhf|vhf)-/, ''),
    label: row.label,
    address: partner ? `${hexAbs(row.offset)} / ${hexAbs(partner.offset)}` : hexAbs(row.offset),
    cells: [decimalCell(row), ...(partner ? [decimalCell(partner)] : [])],
    confidence: { layout: 'traced', meaning: meaningOf(row) },
    source: row.evidence,
    ...(note ? { note } : {}),
  };
}

/** UHF / VHF rows paired by their shared id suffix, in UHF order. */
function bandTable(
  rows: readonly OpenGd77CalibrationRow[],
  spec: { id: string; title: string; description: string; group: string; folded?: boolean },
): ValueTableView {
  const uhf = rows.filter((r) => r.group === spec.group && r.band === 'UHF');
  return {
    id: spec.id,
    title: spec.title,
    description: spec.description,
    layout: { bands: ['UHF', 'VHF'] },
    ...(spec.folded ? { folded: true } : {}),
    rows: uhf.map((u) => {
      const v = rows.find((r) => r.band === 'VHF' && r.id === u.id.replace(/^uhf-/, 'vhf-'));
      const row = valueRow(u, v);
      return {
        ...row,
        cells: [decimalCell(u), v ? decimalCell(v) : { availability: 'not-captured' }],
      };
    }),
  };
}

const POWER_IDS = ['high-power', 'mid-power', 'low-power', 'low-slot-power'] as const;
const SQUELCH_IDS = [
  { id: 'squelch-open-9', label: 'Open, level 9' },
  { id: 'squelch-close-9', label: 'Close, level 9' },
  { id: 'squelch-open-1', label: 'Open, level 1' },
  { id: 'squelch-close-1', label: 'Close, level 1' },
] as const;

/** Calibration view for an OpenGD77 DM-1701 / MD-9600 archive. */
export function openGd77CalibrationView(archive: OpenGd77CalibrationArchive): CalibrationView {
  const selection = selectOpenGd77Calibration(archive);
  if (selection.status === 'not-captured')
    return notCaptured(
      'This archive has no calibration working copy (a Backup read, or a debug read from before this capture). The Hex tab still shows every region it holds.',
    );
  if (selection.status === 'unavailable')
    return {
      status: {
        kind: 'refused',
        reason: `${selection.reason}. The Hex tab still shows the stored bytes.`,
      },
      charts: [],
      tables: [],
      hex: [],
    };
  const { decode, bytes: raw, model } = selection;
  const rows = decode.rows;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const identity = openGd77DebugIdentity(archive.sidecars);
  const revision = identity?.status === 'ok' ? identity.revision : 'unknown';
  const buildDate = identity?.status === 'ok' ? identity.buildDate : 'unknown';
  const dm = model.calibrationLowSlot === 'very-low';

  const lines = [
    'Units and meanings come from reading the OpenGD77 source (each row says what it was traced to), and nothing on this page says whether a value is good, bad or healthy.',
    'OpenGD77 working copy, not stock factory calibration. It is what the firmware serves from RAM.',
    ...(dm
      ? [
          'DM-1701: the working copy is scaled from the factory values at import (Low x1.00, Mid x0.85 VHF or x0.86 UHF, High x1.30 VHF or x1.70 UHF), and the very-low power slot is synthesised by OpenGD77 from Low, so these power values are not the stock factory numbers.',
        ]
      : []),
  ];

  const charts: CalibrationChart[] = decode.markerPresent
    ? BANDS.flatMap((b) => {
        const get = (id: string) => byId.get(`${b.id}-${id}`);
        const grids = model.calibrationGrids;
        const powerMhz = b.id === 'uhf' ? grids.uhf : grids.vhfPower;
        const tuningMhz = b.id === 'uhf' ? grids.uhf : grids.vhfTuning;
        return [
          curve(b, {
            id: 'power',
            title: 'power',
            meaning: 'PA drive code per power level at each frequency point.',
            about:
              'One byte per frequency point for each power slot; the firmware picks the entry for the TX frequency. Drive DAC value = byte × 16.',
            yLabel: 'PA drive code ÷ 16',
            series: POWER_IDS.map((id) => ({
              id,
              label: powerName(get(id)?.label ?? id),
              row: get(id),
            })),
            grid: {
              mhz: powerMhz,
              note: gridNote('the power points', powerMhz, grids.evidence.power),
            },
          }),
          curve(b, {
            id: 'rx-tuning',
            title: 'RX front-end tuning',
            meaning: 'RX front-end tuning byte at each frequency point.',
            about: dm
              ? 'Stock values; the DM-1701 tree has no reader for them, so this is for reference only.'
              : 'Varactor DAC code ÷ 16 by RX frequency.',
            yLabel: 'Tuning code ÷ 16',
            series: [{ id: 'rx-tuning', label: 'RX tuning', row: get('rx-tuning') }],
            grid: {
              mhz: tuningMhz,
              note: gridNote('the RX tuning points', tuningMhz, grids.evidence.tuning),
            },
          }),
          curve(b, {
            id: 'squelch',
            title: 'squelch thresholds',
            meaning: 'Stock squelch open and close thresholds at levels 1 and 9.',
            about:
              'Stock values only: OpenGD77 does not read them (its squelch is its own, in trx.c).',
            yLabel: 'Squelch threshold',
            series: SQUELCH_IDS.map((s) => ({ id: s.id, label: s.label, row: get(s.id) })),
          }),
          trimChart(b, get('oscillator-tune')),
        ];
      }).filter((c) => c !== undefined)
    : [];

  const reference = rows.filter((r) => r.group === 'Reference');
  const frequencyPoints = BANDS.map((b) =>
    rows.filter((r) => r.group === 'Frequency points' && r.band === b.band),
  );
  const tables: ValueTableView[] = [
    {
      id: 'reference',
      title: 'Reference',
      description: 'Single bytes read by nothing in OpenGD77 or with no known meaning.',
      layout: 'single' as const,
      rows: reference.map((r) => valueRow(r)),
    },
    bandTable(rows, {
      id: 'ctcss',
      title: 'CTCSS deviation',
      description: 'Stock deviation per frequency point; OpenGD77 hard-codes its own.',
      group: 'CTCSS',
    }),
    bandTable(rows, {
      id: 'dcs',
      title: 'DCS deviation',
      description: 'Stock deviation per frequency point; OpenGD77 hard-codes its own.',
      group: 'DCS',
    }),
    bandTable(rows, {
      id: 'gains',
      title: 'DMR and FM I/Q gains',
      description: 'HR-C6000 page 4 register values (0–255, no physical unit) per frequency point.',
      group: 'Gains',
    }),
    {
      id: 'frequency-points',
      title: 'Frequency points',
      description:
        'Stock tuning points, little-endian BCD in 10 Hz units (encoding inferred). UHF entries 0 and 1 hold the OpenGD77 local marker. Decoded only when the marker is present.',
      layout: { bands: ['UHF', 'VHF'] },
      folded: true,
      rows: frequencyPoints[0]!.map((u, i) => {
        const v = frequencyPoints[1]![i];
        return {
          ...valueRow(u, v),
          id: `frequency-${i}`,
          label: i < 2 ? `Entry ${i}` : `Point ${Math.floor(i / 2)} ${i % 2 === 0 ? 'RX' : 'TX'}`,
          cells: [decimalCell(u), v ? decimalCell(v) : { availability: 'not-captured' as const }],
        };
      }),
    },
  ].filter((t) => t.rows.length > 0);

  const unused: UnusedRange[] = decode.unknownRanges.map((r) => ({
    start: hexAbs(r.offset),
    end: hexAbs(r.offset + r.length - 1),
    bytes: r.length,
    why: r.meaning,
  }));
  const hex: HexSource[] = [
    {
      id: 'calibration',
      label: `Working copy ${hexAbs(0)}–${`0x${REGION_LAST.toString(16).toUpperCase()}`}`,
      address: OPENGD77_CALIBRATION_ADDRESS,
      bytes: raw,
    },
  ];

  return {
    status: { kind: 'ok' },
    notice: { title: 'Not validated on hardware', tone: 'caution', lines },
    facts: [
      { label: 'Radio', value: model.label },
      {
        label: 'Region',
        value: `${hexAbs(0)}–0x${REGION_LAST.toString(16).toUpperCase()} · ${count(raw.length)} bytes`,
      },
      {
        label: 'Local marker',
        value: decode.markerPresent
          ? `Present at ${hexOff(0x1b0)}`
          : "Absent: this is not the layout the firmware's loader writes, so decoded values and charts are not shown",
      },
      {
        label: 'Layout basis',
        value: 'OpenGD77 sources 2026-01-30 (DM-1701 family) and 2026-01-31 (MD-9600)',
      },
      {
        label: 'Reported firmware',
        value: `revision ${revision}, built ${buildDate}, as reported; whether that build uses the same layout is unknown`,
      },
    ],
    charts,
    tables,
    unused,
    hex,
  };
}
