/**
 * The DM-32UV Calibration tab as a radio-neutral `CalibrationView`, built from the field registry
 * in `calibrationFields.ts`. Every address, index rule and caveat the page shows is here; the
 * shared tab and kit components only draw it. Values come from the captured bytes, never from a
 * sidecar (sidecar hashes are a cross-check only). Read-only: nothing here edits or rereads the
 * radio.
 */
import type {
  BatteryLadder,
  CalibrationChart,
  CalibrationView,
  FrequencyCurve,
  HexSource,
  NumericTableView,
  StepBars,
  UnusedRange,
  ValueRow,
  ValueTableView,
} from '../../debugView/index.ts';
import { sha256HexSync } from '../uv5r-mini/firmwareUpdate/sha256Sync.ts';
import { decodeDm32CalibrationPage } from './calibrationDecode.ts';
import {
  DM32_CALIBRATION_BASIS_FIRMWARE,
  describeDm32CalibrationPage,
  describeDm32FactorySector,
  readDm32SidecarClaims,
  selectDm32LiveCalibration,
  type Dm32CalibrationRow,
} from './calibrationFields.ts';
import { DM32_MODEL_IDS } from './constants.ts';
import type { Dm32CompareArchive } from './debugCompare.ts';
import { dm32DebugIdentity } from './debugCoverage.ts';

const hexAddress = (a: number) => `0x${a.toString(16).toUpperCase().padStart(8, '0')}`;
const offsetText = (o: number) => `+0x${o.toString(16).toUpperCase().padStart(3, '0')}`;
const POWERS = ['low', 'mid', 'high'] as const;
const POINTS = 5;

const DRIVE_UNIT = 'stored byte; DAC = v × 16';
const SQUELCH_UNIT = 'raw RF threshold units';

function notCaptured(reason: string): CalibrationView {
  return { status: { kind: 'not-captured', reason }, charts: [], tables: [], hex: [] };
}

function crossCheck(claimed: string | null | undefined, computed: string, name: string): string {
  if (claimed === undefined) return `${name} absent: nothing to cross-check`;
  return claimed === computed ? `Agrees with ${name}` : `Differs from ${name}`;
}

/** The five frequency points of a band in MHz; a non-BCD point is `undefined`. */
const pointsMhz = (hz: readonly (number | null)[]): (number | undefined)[] =>
  Array.from({ length: POINTS }, (_, i) => {
    const v = hz[i];
    return v === null || v === undefined ? undefined : v / 1e6;
  });

const bytesAt = (list: readonly number[]): (number | undefined)[] =>
  Array.from({ length: POINTS }, (_, i) => list[i]);

function curveSeries(
  xs: readonly (number | undefined)[],
  lines: readonly {
    id: string;
    label: string;
    slot: number;
    ys: readonly (number | undefined)[];
  }[],
): FrequencyCurve['series'] {
  return lines.flatMap((l) => {
    const points = xs.flatMap((x, i) => {
      const y = l.ys[i];
      return x === undefined || y === undefined ? [] : [{ x, y }];
    });
    return points.length ? [{ id: l.id, label: l.label, slot: l.slot, points }] : [];
  });
}

function pointsTable(
  freqLabel: string,
  xs: readonly (number | undefined)[],
  columns: readonly { id: string; label: string; ys: readonly (number | undefined)[] }[],
): NumericTableView {
  return {
    key: { label: 'Point' },
    rows: Array.from({ length: POINTS }, (_, i) => ({ key: String(i + 1) })),
    columns: [
      { id: 'mhz', label: freqLabel, values: xs, width: 1, format: 'decimal' },
      ...columns.map((c) => ({ id: c.id, label: c.label, values: c.ys, width: 1 as const })),
    ],
  };
}

const BANDS = [
  {
    id: 'uhf',
    label: 'UHF',
    power: (d: ReturnType<typeof decodeDm32CalibrationPage>) => d.uhfPower,
    powerAddress: '+0x040–+0x04E',
    txPoints: (d: ReturnType<typeof decodeDm32CalibrationPage>) => d.frequencyPointsHz.uhfTx,
    rxPoints: (d: ReturnType<typeof decodeDm32CalibrationPage>) => d.frequencyPointsHz.uhfRx,
    levels: (d: ReturnType<typeof decodeDm32CalibrationPage>) => d.levels.uhf,
    levelAddresses: ['+0x064–+0x072', '+0x06E–+0x077'],
    txPointsAddress: '+0x314',
    rxPointsAddress: '+0x300',
  },
  {
    id: 'vhf',
    label: 'VHF',
    power: (d: ReturnType<typeof decodeDm32CalibrationPage>) => d.vhfPower,
    powerAddress: '+0x0D0–+0x0DE',
    txPoints: (d: ReturnType<typeof decodeDm32CalibrationPage>) => d.frequencyPointsHz.vhfTx,
    rxPoints: (d: ReturnType<typeof decodeDm32CalibrationPage>) => d.frequencyPointsHz.vhfRx,
    levels: (d: ReturnType<typeof decodeDm32CalibrationPage>) => d.levels.vhf,
    levelAddresses: ['+0x0E0–+0x0E9', '+0x0EA–+0x0F3'],
    txPointsAddress: '+0x33C',
    rxPointsAddress: '+0x328',
  },
] as const;

type PageDecode = ReturnType<typeof decodeDm32CalibrationPage>;

function powerChart(b: (typeof BANDS)[number], d: PageDecode): FrequencyCurve | undefined {
  const xs = pointsMhz(b.txPoints(d));
  const power = b.power(d);
  const lines = POWERS.map((p, i) => ({
    id: p,
    label: p[0]!.toUpperCase() + p.slice(1),
    slot: i,
    ys: bytesAt(power[p]),
  }));
  const series = curveSeries(xs, lines);
  if (!series.length) return undefined;
  return {
    id: `power-${b.id}`,
    kind: 'frequency-curve',
    title: `${b.label} TX power`,
    meaning: 'TX power drive stored for each of the five TX frequency points, per power level.',
    about:
      `Three rows of five bytes (low, mid, high), one byte per TX frequency point (${b.txPointsAddress}, ` +
      `five BCD points). Adjust mode sends the stored byte × 16 to the DAC (0x140F000C). Bytes are shown as stored; ` +
      'watts are unknown.',
    address: b.powerAddress,
    confidence: { layout: 'traced', meaning: 'traced' },
    x: { label: 'TX frequency point', unit: 'MHz' },
    y: { label: `Drive (${DRIVE_UNIT})`, unit: DRIVE_UNIT },
    series,
    table: pointsTable(
      'TX MHz',
      xs,
      lines.map((l) => ({ id: l.id, label: l.label, ys: l.ys })),
    ),
  };
}

function squelchChart(
  b: (typeof BANDS)[number],
  d: PageDecode,
  pair: 0 | 1,
): FrequencyCurve | undefined {
  const xs = pointsMhz(b.rxPoints(d));
  const entry = b.levels(d)[pair]!;
  const lines = [
    { id: 'level1', label: 'Level 1', slot: 0, ys: bytesAt(entry.level1) },
    { id: 'level9', label: 'Level 9', slot: 1, ys: bytesAt(entry.level9) },
  ];
  const series = curveSeries(xs, lines);
  if (!series.length) return undefined;
  return {
    id: `squelch-${b.id}-${pair + 1}`,
    kind: 'frequency-curve',
    title: `${b.label} squelch thresholds, pair ${pair + 1}`,
    meaning: 'Squelch threshold at squelch levels 1 and 9, per frequency point.',
    about:
      `Two rows of five bytes: squelch level 1 and level 9. Levels 2 to 8 are interpolated by the channel squelch, ` +
      `and the result is written to RF register 0x78. Units are raw RF threshold units. Each band has two pairs; ` +
      `what separates them is not traced. Plotting against the five RX frequency points (${b.rxPointsAddress}) is inferred ` +
      'from the shared five-point layout, not traced.',
    address: b.levelAddresses[pair],
    confidence: { layout: 'traced', meaning: 'partially-traced' },
    x: { label: 'RX frequency point', unit: 'MHz' },
    y: { label: `Threshold (${SQUELCH_UNIT})`, unit: SQUELCH_UNIT },
    series,
    table: pointsTable(
      'RX MHz',
      xs,
      lines.map((l) => ({ id: l.id, label: l.label, ys: l.ys })),
    ),
  };
}

/** The 108–136 MHz pair has no frequency points of its own, so it is drawn by point index. */
function airbandChart(d: PageDecode): StepBars {
  const { level1, level9 } = d.levels.airband;
  const bars = [
    ...bytesAt(level1).map((value, i) => ({ id: `l1-p${i + 1}`, label: `L1·${i + 1}`, value })),
    ...bytesAt(level9).map((value, i) => ({ id: `l9-p${i + 1}`, label: `L9·${i + 1}`, value })),
  ];
  return {
    id: 'squelch-air',
    kind: 'step-bars',
    title: '108–136 MHz squelch thresholds',
    meaning: 'Squelch threshold at levels 1 and 9, five points each.',
    about:
      'One pair of five bytes (+0x080 level 1, +0x085 level 9). The airband has no frequency points in the page, so the ' +
      'bars are labelled level and point number (L1·3 is level 1, point 3). Raw RF threshold units.',
    address: '+0x080–+0x089',
    confidence: { layout: 'traced', meaning: 'partially-traced' },
    x: { label: 'Level and point' },
    y: { label: `Threshold (${SQUELCH_UNIT})`, unit: SQUELCH_UNIT, domain: 'auto' },
    bars,
    table: {
      key: { label: 'Point' },
      rows: Array.from({ length: POINTS }, (_, i) => ({ key: String(i + 1) })),
      columns: [
        { id: 'level1', label: 'Level 1', values: bytesAt(level1), width: 1 },
        { id: 'level9', label: 'Level 9', values: bytesAt(level9), width: 1 },
      ],
    },
  };
}

function batteryChart(d: PageDecode): BatteryLadder {
  const { thresholdRaw, scale, scaleValid } = d.battery;
  return {
    id: 'battery',
    kind: 'battery',
    title: 'Battery',
    meaning: 'Battery low threshold (10 mV units, inferred) and the ADC scale it is compared on.',
    about:
      'The threshold (+0x00C) is a raw u16, stored unmasked and unchecked, compared against the scaled battery voltage ' +
      '(10 mV units, inferred, so volts = threshold ÷ 100). The ADC scale (+0x00E) is masked 0xFFF; valid 1–1000, otherwise ' +
      `the firmware uses its default 0x284 (644). Voltage = raw × 750 ÷ scale.${
        scaleValid
          ? ''
          : ` This capture stores ${scale}, outside 1–1000, so the firmware default applies.`
      }`,
    address: '+0x00C–+0x00F',
    confidence: { layout: 'traced', meaning: 'inferred' },
    steps: [
      { id: 'scale', label: 'ADC scale', raw: scale },
      { id: 'threshold', label: 'Threshold', raw: thresholdRaw, volts: thresholdRaw / 100 },
    ],
    table: {
      key: { label: 'Field' },
      rows: [{ key: 'ADC scale (masked 0xFFF)' }, { key: 'Threshold (10 mV units, inferred)' }],
      columns: [{ id: 'raw', label: 'Stored', values: [scale, thresholdRaw], width: 2 }],
    },
  };
}

/** Fields that read best as a plain integer rather than hex plus decimal. */
const DECIMAL_ROWS = new Set(['scalar-00c', 'boot-027', 'adc-channel-1', 'adc-channel-1-b']);

function valueRow(row: Dm32CalibrationRow): ValueRow {
  const note = [row.reason, row.note].filter(Boolean).join(' ');
  const decimal = DECIMAL_ROWS.has(row.id) && typeof row.value === 'number';
  return {
    id: row.id,
    label: row.label,
    group: row.group,
    address: `${offsetText(row.offset)}, ${row.length} ${row.length === 1 ? 'byte' : 'bytes'}`,
    cells: [
      {
        raw: row.raw,
        availability: 'captured',
        ...(decimal
          ? { value: row.value as number, format: 'decimal' as const }
          : row.decoded !== undefined
            ? { decoded: row.decoded }
            : {}),
      },
    ],
    confidence: { layout: row.layoutConfidence, meaning: row.meaningConfidence },
    source: row.source,
    ...(note ? { note } : {}),
  };
}

const GROUP_BLURB: Record<string, string> = {
  'Band limits': 'Interpolation domain only; not a transmit limit.',
  'Frequency points':
    'Five BCD points per band and direction. The power and squelch tables index into them.',
  'TX power': 'One byte per TX frequency point; the charts above draw these rows.',
  'Level pairs': 'Squelch thresholds at levels 1 and 9; the charts above draw these rows.',
  Scalars: 'Battery threshold and ADC scale; the battery card draws them.',
  'Factory options':
    'Option bytes copied to RAM at boot. The anti-clone key is not decoded here; it appears only in the raw bytes.',
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function groupTables(
  rows: readonly Dm32CalibrationRow[],
  skipGroups: ReadonlySet<string>,
): ValueTableView[] {
  const order: string[] = [];
  const byGroup = new Map<string, Dm32CalibrationRow[]>();
  for (const r of rows) {
    if (skipGroups.has(r.group)) continue;
    if (!byGroup.has(r.group)) {
      byGroup.set(r.group, []);
      order.push(r.group);
    }
    byGroup.get(r.group)!.push(r);
  }
  return order.map((g) => ({
    id: slug(g),
    title: g,
    ...(GROUP_BLURB[g] ? { description: GROUP_BLURB[g] } : {}),
    layout: 'single' as const,
    rows: byGroup.get(g)!.map(valueRow),
  }));
}

function unusedRanges(rows: readonly Dm32CalibrationRow[]): UnusedRange[] {
  return rows
    .filter((r) => r.layoutConfidence === 'unknown')
    .map((r) => ({
      start: offsetText(r.offset),
      end: offsetText(r.offset + r.length - 1),
      bytes: r.length,
      why: `Present, purpose unexplained. ${r.source}`,
    }));
}

const UNUSED_GROUP = new Set(['Unknown']);

/** Calibration view for a DM-32UV archive; "not captured" for anything else. */
export function dm32CalibrationView(archive: Dm32CompareArchive): CalibrationView {
  const modelId = archive.manifest.radioModelId;
  if (!(DM32_MODEL_IDS as readonly string[]).includes(modelId))
    return notCaptured(
      `Archive model ${modelId} is not a DM-32UV capture, so no calibration is shown.`,
    );

  const selection = selectDm32LiveCalibration(archive);
  const { coverage } = selection;
  const identity = dm32DebugIdentity(archive.sidecars, coverage.windowRegions, archive.regions);
  const claims = readDm32SidecarClaims(archive.sidecars);
  const hasPage = selection.page !== undefined && selection.address !== undefined;
  const refusedText = selection.refused
    .map(
      ({ region, reason }) =>
        `${region.label} (${region.id}, ${hexAddress(region.address)}): ${reason}`,
    )
    .join('; ');
  const factoryNotKept = claims.factory && !claims.factory.kept ? claims.factory : undefined;

  if (!hasPage && !selection.factory) {
    const why = coverage.window
      ? 'No page tagged 0x02 was captured inside the configuration window.'
      : 'The archive does not state a valid configuration window, so no calibration page can be selected.';
    return notCaptured(
      refusedText
        ? `${why} Regions not used (never searched for calibration): ${refusedText}`
        : why,
    );
  }

  const v01 = identity.baseFirmware;
  const v01Text = v01?.failed ? undefined : v01?.text;
  const notice = {
    title: 'Not validated on hardware',
    tone: 'caution' as const,
    lines: [
      `Layout basis: stock ${DM32_CALIBRATION_BASIS_FIRMWARE}, traced in firmware analysis only. Captured V01 base version: ${
        v01Text ?? 'Not captured'
      }. Running firmware and mod: Unknown. Repeat reads and sidecar agreement are not validation.`,
      ...(v01Text !== undefined && v01Text.trim() !== DM32_CALIBRATION_BASIS_FIRMWARE
        ? [
            'The captured base version differs from the layout basis, so these offsets may not apply to this radio.',
          ]
        : []),
      'No value has a physical unit or validity band, and none is a health verdict: units are raw register, DAC or ADC units. Every byte not in a field below, including +0x096 onward, is only in the raw bytes.',
    ],
  };

  const facts: { label: string; value: string }[] = [];
  const hex: HexSource[] = [];
  const charts: CalibrationChart[] = [];
  const tables: ValueTableView[] = [];
  let unused: UnusedRange[] = [];

  if (hasPage) {
    const page = selection.page!;
    const address = selection.address!;
    const live = sha256HexSync(page);
    facts.push(
      {
        label: 'Live page',
        value: `${hexAddress(address)} · tag 0x02 · lowest in-window tag 0x02 page (the address moves whenever the radio saves calibration)`,
      },
      { label: 'SHA-256', value: live },
      {
        label: 'Cross-check',
        value: `${crossCheck(claims.calibration?.sha256, live, 'calibration.json')}; values are decoded from the captured bytes, never from the sidecar`,
      },
    );
    for (const dup of selection.duplicates)
      facts.push({
        label: 'Duplicate tag 0x02 page (not decoded)',
        value: `${hexAddress(dup.address)} · SHA-256 ${sha256HexSync(dup.page)} · raw bytes below`,
      });
    hex.push({
      id: 'live',
      label: `Live calibration page · ${hexAddress(address)}`,
      address,
      bytes: page,
    });
    for (const dup of selection.duplicates)
      hex.push({
        id: `dup-${dup.address}`,
        label: `Duplicate page · ${hexAddress(dup.address)}`,
        address: dup.address,
        bytes: dup.page,
      });

    const decode = decodeDm32CalibrationPage(page, address);
    for (const b of BANDS) {
      const c = powerChart(b, decode);
      if (c) charts.push(c);
    }
    for (const b of BANDS)
      for (const pair of [0, 1] as const) {
        const c = squelchChart(b, decode, pair);
        if (c) charts.push(c);
      }
    charts.push(airbandChart(decode), batteryChart(decode));

    const rows = describeDm32CalibrationPage(page, address);
    tables.push(...groupTables(rows, UNUSED_GROUP));
    unused = unusedRanges(rows);
  } else {
    facts.push({
      label: 'Live page',
      value: coverage.window
        ? 'Not captured: no page tagged 0x02 inside the configuration window'
        : 'Not captured: the archive does not state a valid configuration window',
    });
  }

  if (selection.factory) {
    const sector = selection.factory;
    const hash = sha256HexSync(sector.bytes);
    facts.push(
      {
        label: 'Factory sector',
        value: `${hexAddress(sector.address)} · 4096 bytes · inspect only · SHA-256 ${hash}`,
      },
      {
        label: 'Factory cross-check',
        value: crossCheck(claims.factory?.sha256, hash, 'factory-sector.json'),
      },
    );
    hex.push({
      id: 'factory',
      label: `Factory sector · ${hexAddress(sector.address)}`,
      address: sector.address,
      bytes: sector.bytes,
    });
    tables.push(
      ...groupTables(describeDm32FactorySector(sector.bytes), new Set()).map((t) => ({
        ...t,
        id: `factory-${t.id}`,
        title: 'Factory sector: options',
      })),
    );
  } else {
    facts.push({
      label: 'Factory sector',
      value: factoryNotKept
        ? `Not kept (${
            factoryNotKept.reason === 'failed'
              ? 'a read failed'
              : factoryNotKept.reason === 'mismatch'
                ? 'two reads disagreed'
                : 'reason not recorded'
          })`
        : 'Not captured',
    });
  }
  facts.push({
    label: 'Chip UID, not a serial',
    value: identity.chipUidHex ? `0x${identity.chipUidHex.toUpperCase()}` : 'Not captured',
  });
  if (refusedText)
    facts.push({
      label: 'Regions not used (never searched for calibration)',
      value: refusedText,
    });

  return {
    status: { kind: 'ok' },
    notice,
    facts,
    charts,
    tables,
    ...(unused.length ? { unused } : {}),
    hex,
  };
}
