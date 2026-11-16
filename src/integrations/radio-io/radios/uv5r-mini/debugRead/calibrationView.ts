/**
 * The UV-5R Mini Calibration tab as a radio-neutral `CalibrationView`, built from the layout and
 * decoder in `calibrationLayout.ts`. Every address, index rule and caveat the page shows is here;
 * the shared tab and kit components only draw it. Read-only: nothing here edits or rereads the
 * radio.
 */
import type {
  BatteryLadder,
  CalibrationChart,
  CalibrationView,
  Confidence,
  FrequencyCurve,
  NumericTableView,
  StepBars,
  TrimView,
  UnusedRange,
  ValueRow,
  ValueTableView,
} from '../../../debugView/index.ts';
import { formatHexDec } from '../../../debugView/index.ts';
import {
  decodeUv5rMiniCalibration,
  UV5R_MINI_BATTERY_STEPS,
  UV5R_MINI_CALIBRATION_END,
  UV5R_MINI_CALIBRATION_LAYOUT,
  UV5R_MINI_CALIBRATION_START,
  UV5R_MINI_PA_POINTS,
  UV5R_MINI_PA_SEGMENTS,
  UV5R_MINI_TRIM_CENTRE,
  UV5R_MINI_TRIM_MAX,
  UV5R_MINI_TRIM_PPM_PER_STEP,
  UV5R_MINI_TRIM_SPAN_PPM,
  type Uv5rMiniCalibration,
  type Uv5rMiniCalibrationBytes,
  type Uv5rMiniConfidence,
} from './calibrationLayout.ts';
import { UV5R_MINI_FULL_READ_SIZE } from './fullRead.ts';

/** What the view needs of an archive: the manifest's model id and the stored region bytes. */
export interface Uv5rMiniCalibrationArchive {
  manifest: { radioModelId: string };
  regions: Readonly<Record<string, Uint8Array>>;
}

/** The decoded 64 KiB clone image is stored as this region. */
export const UV5R_MINI_CLONE_REGION_ID = 'clone';
const MODEL_ID = 'UV-5R Mini';

const hexAddress = (a: number) => `0x${a.toString(16).toUpperCase().padStart(4, '0')}`;
const hexRange = (start: number, endExclusive: number) =>
  endExclusive - start === 1
    ? hexAddress(start)
    : `${hexAddress(start)}–${hexAddress(endExclusive - 1)}`;
const count = (n: number) => n.toLocaleString('en-GB');

const confidence = (c: Uv5rMiniConfidence): Confidence => (c === 'partly' ? 'partially-traced' : c);

const NOTICE = {
  title: 'Not validated on hardware',
  tone: 'caution' as const,
  lines: [
    'Layout from a static trace of v0.04 app.bin (radio repo PR #219); v0.27 runs the same code relocated. Applicability to this radio is not confirmed. Stable reads and plausible values do not establish calibration health.',
    'The calibration was written as ten whole clone frames from one buffer, so bytes nothing reads are frame residue, not free space: the calibration sector is erased whole by a write at 0xF000. This page only shows bytes; it never writes them.',
  ],
};

function notCaptured(reason: string): CalibrationView {
  return { status: { kind: 'not-captured', reason }, charts: [], tables: [], hex: [] };
}

/** Per-frequency offsets: the point `i` sits at `baseMhz + stepMhz × i`; leading `used` bytes are read. */
const OFFSETS = [
  { id: 'squelchOffsetUhf', short: 'uhf', label: 'UHF', baseMhz: 400, stepMhz: 10 },
  { id: 'squelchOffsetVhf', short: 'vhf', label: 'VHF', baseMhz: 130, stepMhz: 5 },
  { id: 'squelchOffset200', short: '200', label: '200 MHz', baseMhz: 200, stepMhz: 5 },
  { id: 'squelchOffset350', short: '350', label: '350 MHz', baseMhz: 350, stepMhz: 5 },
] as const;

const rangeOf = (id: string) => UV5R_MINI_CALIBRATION_LAYOUT.find((r) => r.id === id)!;

function paCharts(cal: Uv5rMiniCalibration): CalibrationChart[] {
  return cal.paBias.map((seg) => {
    const { segment } = seg;
    const used = segment.usedPoints;
    const lo = segment.baseMhz;
    const hi = lo + segment.stepMhz * (used - 1);
    const lines = seg.levels.map((line) => ({
      id: `level${line.level}`,
      label: line.name,
      slot: line.level,
      points: line.points.filter((p) => p.used).map((p) => ({ x: p.mhz, y: p.value })),
    }));
    const first = seg.levels[0]!.points[0]!;
    const rowOffset = segment.index * UV5R_MINI_PA_POINTS;
    const table: NumericTableView = {
      key: { label: 'Point' },
      rows: Array.from({ length: used }, (_, i) => ({ key: String(i) })),
      columns: [
        {
          id: 'mhz',
          label: 'MHz',
          values: seg.levels[0]!.points.filter((p) => p.used).map((p) => p.mhz),
          width: 1,
          format: 'decimal',
        },
        ...seg.levels.map((line) => ({
          id: `level${line.level}`,
          label: line.name,
          values: line.points.filter((p) => p.used).map((p) => p.value),
          width: 1 as const,
        })),
      ],
    };
    const chart: FrequencyCurve = {
      id: `pa-${segment.label.split(' ')[0]!.toLowerCase()}`,
      kind: 'frequency-curve',
      title: `${segment.label} PA bias, ${lo}–${hi} MHz`,
      meaning: 'PA bias byte the radio uses at each MHz point, per power index.',
      about:
        `Three frames by power index (0xF000 High, 0xF040 level 2, 0xF080 Low), four 16-byte rows each in band order UHF, VHF, 200, 350 MHz; ` +
        `this is row +0x${rowOffset.toString(16).toUpperCase().padStart(2, '0')} of each frame, from ${hexAddress(first.address)}. ` +
        `Point i = ${lo} + ${segment.stepMhz} × i MHz; index ${segment.indexRule}; ${used} of ${UV5R_MINI_PA_POINTS} points are read, the rest of the row has no reader. ` +
        'The byte becomes the high byte of RF register 0x36 (0 gives 0x007F); the unit is unknown. The power index is the VFO frame’s power byte; level 2 has no menu entry (its name is inferred). Loader 0x1E48F94, table 0x1E659A0.' +
        (segment.calibrated
          ? ''
          : ' Not calibrated: all zero on the radios read, so the firmware falls back to 0x007F.'),
      address: hexRange(first.address, first.address + used),
      confidence: { layout: 'traced', meaning: 'traced' },
      x: { label: 'Frequency', unit: 'MHz' },
      y: { label: 'Byte', unit: 'unit unknown' },
      series: lines,
      table,
    };
    return chart;
  });
}

function levelBars(range: Uv5rMiniCalibrationBytes): StepBars['bars'] {
  return Array.from(range.bytes, (value, i) => ({
    id: `l${i}`,
    label: String(i),
    value,
  }));
}

function squelchCharts(cal: Uv5rMiniCalibration): StepBars[] {
  return cal.squelch.thresholds.map((row) => {
    const open = row.id === 'squelchOpen';
    return {
      id: open ? 'squelch-open' : 'squelch-close',
      kind: 'step-bars' as const,
      title: row.label,
      meaning: open
        ? 'RSSI count at which squelch opens, by squelch level 0–9.'
        : 'RSSI count at which squelch closes, by squelch level 0–9.',
      about: `${row.note}. The per-frequency offsets (below) are subtracted from this value.`,
      address: hexRange(row.start, row.end),
      confidence: { layout: row.confidence, meaning: row.confidence } as {
        layout: Confidence;
        meaning: Confidence;
      },
      x: { label: 'Squelch level' },
      y: { label: 'Threshold', unit: 'RSSI counts', domain: [0, 255] as const },
      bars: levelBars(row),
      table: {
        key: { label: 'Level' },
        rows: Array.from(row.bytes, (_, i) => ({ key: String(i) })),
        columns: [{ id: 'value', label: row.label, values: Array.from(row.bytes), width: 1 }],
      },
    };
  });
}

function offsetCharts(cal: Uv5rMiniCalibration): StepBars[] {
  return OFFSETS.map((o, i) => {
    const row = cal.squelch.offsets[i]!;
    const used = Array.from(row.bytes.subarray(0, row.used));
    const mhz = used.map((_, k) => o.baseMhz + o.stepMhz * k);
    return {
      id: `squelch-offset-${o.short}`,
      kind: 'step-bars' as const,
      title: row.label,
      meaning: 'Count subtracted from the squelch thresholds at each frequency point.',
      about: `${row.note}. Only the first ${row.used} of ${row.bytes.length} bytes are read; the bars scale to the data so small offsets show.`,
      address: hexRange(row.start, row.start + row.used),
      confidence: { layout: row.confidence, meaning: row.confidence } as {
        layout: Confidence;
        meaning: Confidence;
      },
      x: { label: 'MHz' },
      y: { label: 'Offset', unit: 'RSSI counts', domain: 'auto' as const },
      bars: used.map((value, k) => ({ id: `p${k}`, label: String(mhz[k]), value })),
      table: {
        key: { label: 'Point' },
        rows: used.map((_, k) => ({ key: String(k) })),
        columns: [
          { id: 'mhz', label: 'MHz', values: mhz, width: 1, format: 'decimal' as const },
          { id: 'value', label: 'Offset', values: used, width: 1 },
        ],
      },
    };
  });
}

function batteryChart(cal: Uv5rMiniCalibration): BatteryLadder {
  const range = rangeOf('battery');
  const values = cal.battery.values;
  return {
    id: 'battery',
    kind: 'battery',
    title: 'Battery thresholds',
    meaning: `${UV5R_MINI_BATTERY_STEPS} threshold bytes, lowest step first; the unit is not known.`,
    about: `${range.note}. Raw bytes only: the scale to volts is not known.`,
    address: hexRange(range.start, range.end),
    confidence: { layout: 'traced', meaning: 'partially-traced' },
    steps: values.map((raw, i) => ({ id: `step${i + 1}`, label: `Step ${i + 1}`, raw })),
    ...(cal.battery.blank
      ? {
          blank: `All six read 0xFF (blank).${
            cal.blank
              ? ' 0xF000 reads as erased, so the firmware uses its built-in thresholds.'
              : ''
          }`,
        }
      : {}),
    table: {
      key: { label: 'Step' },
      rows: values.map((_, i) => ({ key: String(i + 1) })),
      columns: [{ id: 'raw', label: 'Stored', values, width: 1 }],
    },
  };
}

function trimChart(cal: Uv5rMiniCalibration): TrimView {
  const raw = cal.trim.value;
  return {
    id: 'trim',
    kind: 'trim',
    title: 'Frequency trim',
    meaning: `Index 0–${UV5R_MINI_TRIM_MAX} into a 17-entry table: ${UV5R_MINI_TRIM_CENTRE} is 0 ppm, each step ${UV5R_MINI_TRIM_PPM_PER_STEP} ppm.`,
    about: `${cal.trim.note}. ±${UV5R_MINI_TRIM_SPAN_PPM} ppm at the ends. Above ${UV5R_MINI_TRIM_MAX} the firmware uses index ${UV5R_MINI_TRIM_CENTRE} (0 ppm).`,
    address: hexAddress(cal.trim.address),
    confidence: { layout: 'traced', meaning: 'traced' },
    raw,
    scale: { min: 0, max: UV5R_MINI_TRIM_MAX, neutral: UV5R_MINI_TRIM_CENTRE },
    ppm: { perStep: UV5R_MINI_TRIM_PPM_PER_STEP, span: UV5R_MINI_TRIM_SPAN_PPM },
    ...(cal.trim.aboveRange
      ? {
          outOfRange: `Above ${UV5R_MINI_TRIM_MAX} the firmware uses index ${UV5R_MINI_TRIM_CENTRE} (0 ppm)`,
        }
      : {}),
    table: {
      key: { label: 'Field' },
      rows: [{ key: 'Trim index' }],
      columns: [{ id: 'raw', label: 'Stored', values: [raw], width: 1 }],
    },
  };
}

function singleValuesTable(cal: Uv5rMiniCalibration): ValueTableView {
  const rows: ValueRow[] = [...cal.values, cal.region].map((v) => {
    let decoded: string | undefined;
    if (v.id.startsWith('filter')) decoded = `${formatHexDec(v.value)}, set ${v.value & 7}`;
    else if (v.id === 'mic')
      decoded = `${formatHexDec(v.value)}, low 6 bits ${v.value & 0x3f} (v0.04), low 5 bits ${v.value & 0x1f} (v0.27)`;
    else if (v.id === 'region')
      decoded = `${formatHexDec(v.value)}, band-edge table ${cal.region.table}`;
    return {
      id: v.id,
      label: v.label,
      address: hexAddress(v.address),
      cells: [
        {
          raw: Uint8Array.of(v.value),
          availability: 'captured' as const,
          ...(decoded === undefined ? { value: v.value } : { decoded }),
        },
      ],
      confidence: { layout: confidence(v.confidence), meaning: confidence(v.confidence) },
      note: v.note,
    };
  });
  return {
    id: 'single-values',
    title: 'Single values',
    description:
      'One byte each, in address order. The region byte picks the built-in RX band-edge table.',
    layout: 'single',
    rows,
  };
}

function bandLimitsTable(cal: Uv5rMiniCalibration): ValueTableView {
  const limits = cal.bandLimits;
  const mhz = (v: number | null) => (v === null ? 'not BCD' : `${v} MHz`);
  const rows: ValueRow[] = limits.bands.map((band) => {
    const at = band.address - limits.start;
    return {
      id: `band${band.index + 1}`,
      label: `Band ${band.index + 1}`,
      address: `${hexAddress(band.address)}, 4 bytes`,
      cells: [
        {
          raw: limits.bytes.slice(at, at + 2),
          decoded: mhz(band.lowMhz),
          availability: 'captured' as const,
        },
        {
          raw: limits.bytes.slice(at + 2, at + 4),
          decoded: mhz(band.highMhz),
          availability: 'captured' as const,
        },
      ],
      confidence: { layout: 'traced' as const, meaning: 'traced' as const },
    };
  });
  return {
    id: 'band-limits',
    title: 'Band limits',
    description: `${limits.note}.`,
    layout: { bands: ['Low', 'High'] },
    rows,
  };
}

function textTable(cal: Uv5rMiniCalibration): ValueTableView {
  return {
    id: 'text-fields',
    title: 'Text',
    layout: 'single',
    rows: cal.texts.map((t) => ({
      id: t.id,
      label: t.label,
      address: `${hexAddress(t.start)}, ${t.bytes.length} bytes`,
      cells: [{ raw: t.bytes, decoded: t.ascii, availability: 'captured' as const }],
      confidence: { layout: confidence(t.confidence), meaning: confidence(t.confidence) },
      note: t.note,
    })),
  };
}

function unusedRanges(): UnusedRange[] {
  const out: UnusedRange[] = [];
  const add = (start: number, end: number, why: string) =>
    out.push({ start: hexAddress(start), end: hexAddress(end - 1), bytes: end - start, why });
  for (const range of UV5R_MINI_CALIBRATION_LAYOUT) {
    if (range.kind === 'residue') add(range.start, range.end, `${range.label}. ${range.note}`);
    else if (range.kind === 'erased') add(range.start, range.end, `${range.label}. ${range.note}`);
    else if (range.used !== undefined && range.used < range.end - range.start)
      add(
        range.start + range.used,
        range.end,
        `${range.label}: bytes past the first ${range.used} have no reader`,
      );
  }
  for (const seg of UV5R_MINI_PA_SEGMENTS) {
    if (seg.usedPoints >= UV5R_MINI_PA_POINTS) continue;
    for (const frame of [0xf000, 0xf040, 0xf080])
      add(
        frame + seg.index * UV5R_MINI_PA_POINTS + seg.usedPoints,
        frame + (seg.index + 1) * UV5R_MINI_PA_POINTS,
        `PA bias, ${seg.label} row: points past ${seg.usedPoints} have no reader`,
      );
  }
  return out.sort((a, b) => parseInt(a.start, 16) - parseInt(b.start, 16));
}

/** Calibration view for a UV-5R Mini archive; "not captured" for anything else. */
export function uv5rMiniCalibrationView(archive: Uv5rMiniCalibrationArchive): CalibrationView {
  const modelId = archive.manifest.radioModelId;
  if (modelId !== MODEL_ID)
    return notCaptured(
      `Archive model ${modelId} is not a ${MODEL_ID} capture, so no calibration is shown.`,
    );
  const clone = archive.regions[UV5R_MINI_CLONE_REGION_ID];
  if (!clone)
    return notCaptured(
      `This archive has no decoded clone region (${UV5R_MINI_CLONE_REGION_ID}), so the calibration area ${hexRange(UV5R_MINI_CALIBRATION_START, UV5R_MINI_CALIBRATION_END)} was not captured.`,
    );
  if (clone.length < UV5R_MINI_FULL_READ_SIZE)
    return notCaptured(
      `The clone region holds ${count(clone.length)} bytes; a full read is ${count(UV5R_MINI_FULL_READ_SIZE)}, so the calibration area ${hexRange(UV5R_MINI_CALIBRATION_START, UV5R_MINI_CALIBRATION_END)} was not captured.`,
    );

  const cal = decodeUv5rMiniCalibration(clone);
  const area = clone.slice(UV5R_MINI_CALIBRATION_START, UV5R_MINI_CALIBRATION_END);
  return {
    status: { kind: 'ok' },
    notice: {
      ...NOTICE,
      lines: cal.blank
        ? ['0xF000 reads 0xFF: the firmware treats calibration as absent.', ...NOTICE.lines]
        : NOTICE.lines,
    },
    facts: [
      {
        label: 'Region read',
        value: `${hexRange(UV5R_MINI_CALIBRATION_START, UV5R_MINI_CALIBRATION_END)} of the decoded clone image, ${count(area.length)} bytes`,
      },
    ],
    charts: [
      ...paCharts(cal),
      ...squelchCharts(cal),
      ...offsetCharts(cal),
      batteryChart(cal),
      trimChart(cal),
    ],
    tables: [singleValuesTable(cal), bandLimitsTable(cal), textTable(cal)],
    unused: unusedRanges(),
    hex: [
      {
        id: 'calibration',
        label: `Calibration area · ${hexRange(UV5R_MINI_CALIBRATION_START, UV5R_MINI_CALIBRATION_END)}`,
        address: UV5R_MINI_CALIBRATION_START,
        bytes: area,
      },
    ],
    collapseRuns: true,
  };
}
