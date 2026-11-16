/**
 * The RT95 Calibration tab as a radio-neutral `CalibrationView`, built from the static decode in
 * `core/radios/retevis/rt95/calibration.ts`. Every address, index rule and caveat the page shows
 * is here; the shared tab and kit components only draw it. Read-only: nothing here edits or
 * rereads the radio.
 */
import {
  RT95_CALIBRATION_LENGTH,
  RT95_CALIBRATION_START,
  RT95_PROGRAM_PASSWORD_ADDRESS,
  RT95_PROGRAM_PASSWORD_LENGTH,
  decodeRt95Calibration,
  type Rt95Field,
} from '@core/radios/retevis/rt95/calibration.ts';
import type {
  CalibrationChart,
  CalibrationView,
  Confidence,
  FrequencyCurve,
  HexSource,
  NumericTableView,
  StepBars,
  TrimView,
  UnusedRange,
  ValueRow,
  ValueTableView,
} from '../../debugView/index.ts';
import type { RadioBackupManifestV1 } from '../../backup/types.ts';
import { RT95_MODEL_ID } from './constants.ts';
import { RT95_CALIBRATION_REGION_ID } from './debugCapture.ts';

/** What the view needs of an archive: the manifest's model id and the stored region bytes. */
export interface Rt95CalibrationArchive {
  manifest: Pick<RadioBackupManifestV1, 'radioModelId'>;
  regions: Readonly<Record<string, Uint8Array>>;
}

const hexAddress = (a: number) => `0x${a.toString(16).toUpperCase().padStart(4, '0')}`;
const count = (n: number) => n.toLocaleString('en-GB');
const POWERS = ['Low', 'Mid', 'High'] as const;
const REGION_LAST = RT95_CALIBRATION_START + RT95_CALIBRATION_LENGTH - 1;

const NOTICE = {
  title: 'Not validated on hardware',
  tone: 'caution' as const,
  lines: [
    'MAIN V1.61 / head V1.41 static trace; applicability to this radio unknown. The head relays each block and can answer without a main-board reply, returning stale or zero bytes, the previous block (with a valid checksum), or a block shifted by a late reply; captured bytes are what the head returned, not proof of EEPROM contents. Stable reads and plausible values do not establish calibration health.',
    'Deviation words are little-endian (traced). Squelch and S-meter dB scales are inferred, not measured. Bytes marked unused (no reader) are read by nothing in MAIN, the head or the CPS. Stored production strings do not establish running firmware or modification.',
  ],
};

const meaningConfidence = (field: Rt95Field): Confidence => field.meaning;

const byLabel = (fields: readonly Rt95Field[], label: string) =>
  fields.find((f) => f.label === label);

function notCaptured(reason: string): CalibrationView {
  return { status: { kind: 'not-captured', reason }, charts: [], tables: [], hex: [] };
}

const BANDS = [
  { band: 'VHF', startMhz: 136, endMhz: 174 },
  { band: 'UHF', startMhz: 400, endMhz: 490 },
] as const;

/** Power flatness: one chart per band, lines Low/Mid/High, x = band start + index MHz. */
function powerChart(
  fields: readonly Rt95Field[],
  b: (typeof BANDS)[number],
): FrequencyCurve | undefined {
  const lines = POWERS.map((p) => byLabel(fields, `${b.band} power flatness ${p}`));
  const [low, , high] = lines;
  if (!low || !high || lines.some((f) => !f)) return undefined;
  const rows = lines as Rt95Field[];
  const length = low.width;
  const reference = low.referenceIndex!;
  const series = POWERS.flatMap((p, i) => {
    const points = (rows[i]!.corrections ?? []).flatMap((y, index) =>
      y === undefined ? [] : [{ x: b.startMhz + index, y }],
    );
    return points.length ? [{ id: p.toLowerCase(), label: p, slot: i, points }] : [];
  });
  if (!series.length) return undefined;
  const entries = (f: Rt95Field) =>
    Array.from({ length }, (_, i) => (i < f.raw.length ? f.raw[i] : undefined));
  const table: NumericTableView = {
    key: { label: 'MHz' },
    rows: Array.from({ length }, (_, i) => ({
      key: String(b.startMhz + i),
      ...(i === reference ? { mark: 'reference' as const } : {}),
    })),
    columns: POWERS.flatMap((p, i) => [
      {
        id: `${p.toLowerCase()}-entry`,
        label: `${p} entry`,
        values: entries(rows[i]!),
        width: 1 as const,
        deltaFromRow: reference,
      },
      {
        id: `${p.toLowerCase()}-drive`,
        label: `${p} drive`,
        values: rows[i]!.corrections ?? [],
        width: 2 as const,
        format: 'decimal' as const,
      },
    ]),
  };
  return {
    id: `power-${b.band.toLowerCase()}`,
    kind: 'frequency-curve',
    title: `${b.band} power, ${b.startMhz}–${b.endMhz} MHz`,
    meaning: 'PA drive the radio uses at each MHz, per power level.',
    about:
      `Three rows of ${length} per-MHz entries (Low, Mid, High). Index i is ${b.startMhz} + i MHz; ` +
      `reference index ${reference} (${b.startMhz + reference} MHz). Drive = row base + entry − ` +
      'entry at the reference index, in PWM counts (unmasked; the firmware masks to 16 bits). ' +
      'The row base is the PA power byte of the same band (see Per-band values). Source: MAIN 0x08008E06.',
    address: `${hexAddress(low.address)}–${hexAddress(high.address + length - 1)}`,
    confidence: { layout: 'traced', meaning: 'traced' },
    x: { label: 'Frequency', unit: 'MHz' },
    y: { label: 'Drive (PWM counts)', unit: 'PWM counts' },
    series,
    table,
  };
}

/** Squelch or S-meter steps: levels 1-8 (entry 0 is unused). */
function stepChart(
  field: Rt95Field | undefined,
  spec: {
    id: string;
    title: string;
    meaning: string;
    about: string;
    xLabel: string;
    unit: string;
  },
): StepBars | undefined {
  if (!field || field.availability === 'not-captured') return undefined;
  const values = Array.from({ length: 8 }, (_, i) =>
    i + 1 < field.raw.length ? field.raw[i + 1] : undefined,
  );
  return {
    id: spec.id,
    kind: 'step-bars',
    title: spec.title,
    meaning: spec.meaning,
    about: spec.about,
    address: `${hexAddress(field.address)}–${hexAddress(field.address + field.width - 1)}`,
    confidence: { layout: 'traced', meaning: 'inferred' },
    x: { label: spec.xLabel },
    y: { label: 'Step', unit: spec.unit, domain: 'auto' },
    bars: values.map((value, i) => ({ id: `l${i + 1}`, label: String(i + 1), value })),
    table: {
      key: { label: spec.xLabel },
      rows: values.map((_, i) => ({ key: String(i + 1) })),
      columns: [{ id: 'entry', label: 'Entry', values, width: 1 }],
    },
  };
}

function trimChart(field: Rt95Field | undefined, band: string): TrimView | undefined {
  if (!field || field.availability === 'not-captured') return undefined;
  const raw = field.availability === 'captured' ? field.raw[0] : undefined;
  return {
    id: `trim-${band.toLowerCase()}`,
    kind: 'trim',
    title: `${band} reference-oscillator trim (FQC)`,
    meaning: 'Reference-oscillator trim, applied on every RX and TX tune. ppm scale unknown.',
    about:
      '8-bit PWM on TIMER2 CH3 (MAIN 0x0800D5EA); the oscillator and PC9 are inferred. The neutral value and ppm per step are not known, so the display shows the raw 0–255 byte only.',
    address: hexAddress(field.address),
    confidence: { layout: 'traced', meaning: 'traced' },
    raw,
    scale: { min: 0, max: 255 },
    table: {
      key: { label: 'Field' },
      rows: [{ key: `FQC ${band}` }],
      columns: [{ id: 'raw', label: 'Raw', values: [raw], width: 1 }],
    },
  };
}

type Cell = ValueRow['cells'][number];

function cellOf(f: Rt95Field): Cell {
  const decoded =
    f.sensitive && f.revealedText !== undefined ? f.revealedText : (f.text ?? f.decoded);
  return {
    ...(f.availability === 'not-captured' ? {} : { raw: f.raw }),
    ...(f.value !== undefined && f.text === undefined ? { value: f.value } : {}),
    ...(decoded === undefined ? {} : { decoded }),
    availability: f.availability,
    ...(f.sensitive ? { sensitive: true } : {}),
  };
}

function valueRow(f: Rt95Field, label = f.label): ValueRow {
  const note = [f.units ? `Units: ${f.units}` : '', f.note ?? ''].filter(Boolean).join(' · ');
  return {
    id: `${f.address.toString(16)}`,
    label,
    address: `${hexAddress(f.address)}${f.width > 1 ? ` +${f.width}` : ''}`,
    cells: [cellOf(f)],
    confidence: { layout: f.layout, meaning: meaningConfidence(f) },
    source: f.source,
    ...(note ? { note } : {}),
  };
}

const bandless = (label: string) =>
  label
    .replace(/\b(VHF|UHF)\b/, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+\(/, ' (')
    .trim();

/** Per-band values, VHF and UHF side by side, rows paired by meaning. */
function bandTable(fields: readonly Rt95Field[]): ValueTableView {
  const isBandValue = (f: Rt95Field, band: string) =>
    f.address >= 0x3f40 &&
    f.meaning !== 'unused' &&
    f.label.split(' ').includes(band) &&
    !f.label.startsWith('FQC') &&
    !f.label.startsWith('Squelch level steps') &&
    !f.label.startsWith('S-meter steps');
  const uhf = fields.filter((f) => isBandValue(f, 'UHF'));
  const rows = fields
    .filter((f) => isBandValue(f, 'VHF'))
    .map((v): ValueRow => {
      const label = bandless(v.label);
      const u = uhf.find((f) => bandless(f.label) === label);
      return {
        ...valueRow(v, label),
        id: `band-${v.address.toString(16)}`,
        address: `${hexAddress(v.address)} / ${u ? hexAddress(u.address) : '—'}`,
        cells: [cellOf(v), u ? cellOf(u) : { availability: 'not-captured' }],
      };
    });
  return {
    id: 'band-values',
    title: 'Per-band values',
    description:
      'PA power bytes are the row bases of the power charts. Deviation words are little-endian u16. Test-channel frequencies and offsets are big-endian BCD in 10 Hz units, shown in MHz; they belong to the factory test mode and are not a calibration step.',
    layout: { bands: ['VHF', 'UHF'] },
    rows,
  };
}

function unusedRanges(fields: readonly Rt95Field[]): UnusedRange[] {
  const out: { start: number; end: number; whys: string[] }[] = [];
  for (const f of [...fields].sort((a, b) => a.address - b.address)) {
    if (f.meaning !== 'unused') continue;
    const last = out[out.length - 1];
    if (last && last.end === f.address) {
      last.end = f.address + f.width;
      if (!last.whys.includes(f.source)) last.whys.push(f.source);
    } else out.push({ start: f.address, end: f.address + f.width, whys: [f.source] });
  }
  return out.map((r) => ({
    start: hexAddress(r.start),
    end: hexAddress(r.end - 1),
    bytes: r.end - r.start,
    why: r.whys.join('; '),
  }));
}

/** Calibration view for an RT95 archive; "not captured" for anything else. */
export function rt95CalibrationView(archive: Rt95CalibrationArchive): CalibrationView {
  const modelId = archive.manifest.radioModelId;
  if (modelId !== RT95_MODEL_ID)
    return notCaptured(`This archive is for ${modelId}, not an RT95 capture; nothing is decoded.`);
  const bytes = archive.regions[RT95_CALIBRATION_REGION_ID];
  if (!bytes || !bytes.length)
    return notCaptured(
      `This archive has no calibration region (${hexAddress(RT95_CALIBRATION_START)}–${hexAddress(REGION_LAST)}).`,
    );
  const { fields, raw } = decodeRt95Calibration(bytes);

  const charts: CalibrationChart[] = [
    ...BANDS.map((b) => powerChart(fields, b)),
    ...BANDS.map((b) =>
      stepChart(byLabel(fields, `Squelch level steps ${b.band}`), {
        id: `squelch-${b.band.toLowerCase()}`,
        title: `${b.band} squelch steps`,
        meaning: 'Amount taken off the squelch base at each squelch level (dB, inferred).',
        about:
          'Entries 1 to L−1 are subtracted for squelch level L; entry 0 is unused, so levels 1–8 are shown. The dB scale is inferred, not measured. Source: MAIN 0x0800A9E8.',
        xLabel: 'Squelch level',
        unit: 'dB, inferred',
      }),
    ),
    ...BANDS.map((b) =>
      stepChart(byLabel(fields, `S-meter steps ${b.band}`), {
        id: `smeter-${b.band.toLowerCase()}`,
        title: `${b.band} S-meter steps`,
        meaning: 'RSSI register units between S-meter thresholds (about 1 dB, inferred).',
        about:
          'Entries 1–8 are cumulative on the row S-meter base (F137), giving 9 thresholds; entry 0 is unused. The dB scale is inferred. Source: MAIN 0x08007EE8 (VHF), 0x08007F0E (UHF).',
        xLabel: 'S-meter step',
        unit: 'RSSI units, inferred',
      }),
    ),
    ...BANDS.map((b) => trimChart(byLabel(fields, `FQC ${b.band}`), b.band)),
  ].filter((c) => c !== undefined);

  const password = fields.find((f) => f.address === RT95_PROGRAM_PASSWORD_ADDRESS)!;
  const record = fields.filter(
    (f) => f.address < 0x3c00 && f.meaning !== 'unused' && f !== password,
  );
  const tables: ValueTableView[] = [
    {
      id: 'production-record',
      title: 'Production record',
      description: 'Factory strings and versions. Serial numbers are shown in full.',
      layout: 'single',
      rows: record.map((f) => valueRow(f)),
    },
    bandTable(fields),
    {
      id: 'program-password',
      title: 'Program password',
      description:
        'Compared by the CPS on Read and Write; purpose inferred, encoding unconfirmed. Masked until you choose Show password.',
      layout: 'single',
      rows: [valueRow(password)],
    },
  ];

  const hex: HexSource[] = [
    {
      id: 'calibration',
      label: `Calibration region ${hexAddress(RT95_CALIBRATION_START)}–${hexAddress(REGION_LAST)}`,
      address: RT95_CALIBRATION_START,
      bytes: raw,
      sensitive: [{ start: RT95_PROGRAM_PASSWORD_ADDRESS, length: RT95_PROGRAM_PASSWORD_LENGTH }],
    },
  ];

  return {
    status: { kind: 'ok' },
    notice: NOTICE,
    facts: [
      {
        label: 'Region',
        value: `${hexAddress(RT95_CALIBRATION_START)}–${hexAddress(REGION_LAST)}`,
      },
      {
        label: 'Captured',
        value: `${count(raw.length)} of ${count(RT95_CALIBRATION_LENGTH)} bytes`,
      },
      { label: 'Layout basis', value: 'MAIN V1.61 / head V1.41 / CPS 2.01 static decode' },
    ],
    charts,
    tables,
    unused: unusedRanges(fields),
    hex,
  };
}
