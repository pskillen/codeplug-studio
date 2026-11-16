import { newChannel } from '@core/domain/factories.ts';
import type {
  BatteryLadder,
  CalibrationChart,
  EvidenceNoticeView,
  FrequencyCurve,
  HexSource,
  SettingRow,
  SettingsView,
  StepBars,
  TrimView,
  UnusedRange,
  ValueTableView,
} from '@integrations/radio-io/debugView';

export const SAMPLE_ROWS = [
  { id: '1', name: 'GB3DA Stornoway' },
  { id: '2', name: 'GB3IV Inverness' },
];

export const STICKY_DEMO_ROWS = Array.from({ length: 24 }, (_, i) => ({
  id: String(i + 1),
  name: `Channel ${String(i + 1).padStart(2, '0')}`,
  score: (i * 7) % 100,
}));

export const COLUMN_PICKER_ROWS = [
  { id: '1', name: 'Alpha', score: 3, note: 'A' },
  { id: '2', name: 'Bravo', score: 9, note: 'B' },
];

export const LARGE_VIRTUAL_DEMO_ROWS = Array.from({ length: 250 }, (_, i) => ({
  id: String(i + 1),
  name: `Contact ${String(i + 1).padStart(4, '0')}`,
  score: (i * 13) % 100,
}));

export const sampleChannel = {
  ...newChannel('styleguide', 'Demo FM'),
  rxFrequency: 145_575_000,
  txFrequency: 145_175_000,
  modeProfiles: [
    {
      mode: 'fm' as const,
      squelch: null,
      rxTone: 'none',
      txTone: 'none',
      bandwidthKHz: null,
    },
  ],
};

// ---------------------------------------------------------------------------
// Debug-pages kit demo (`/styleguide/debug`). A made-up radio: nothing here comes from a real
// radio, a real read or an operator's archive, and nothing imports a radio home.
// ---------------------------------------------------------------------------

const DEBUG_DEMO_BANDS = [
  { id: 'vhf', label: 'VHF', from: 136, to: 174, step: 6 },
  { id: 'uhf', label: 'UHF', from: 400, to: 470, step: 10 },
] as const;

const DEBUG_DEMO_POWER_LEVELS = ['Low', 'Mid', 'High'] as const;

function debugDemoMhz(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let x = from; x <= to; x += step) out.push(x);
  return out;
}

/** Smooth made-up PA drive, higher for higher power and gently bowed across the band. */
function debugDemoDrive(level: number, x: number, from: number, to: number, shift: number): number {
  const t = (x - from) / (to - from);
  return Math.round(40 + level * 55 + 18 * Math.sin(Math.PI * t) - 10 * t + shift);
}

function debugDemoPowerCurve(
  band: (typeof DEBUG_DEMO_BANDS)[number],
  shift: number,
): FrequencyCurve {
  const xs = debugDemoMhz(band.from, band.to, band.step);
  const series = DEBUG_DEMO_POWER_LEVELS.map((label, level) => ({
    id: label.toLowerCase(),
    label,
    slot: level,
    points: xs.map((x) => ({ x, y: debugDemoDrive(level, x, band.from, band.to, shift) })),
  }));
  return {
    kind: 'frequency-curve',
    id: `power-${band.id}`,
    title: `${band.label} power, ${band.from}–${band.to} MHz`,
    meaning: 'PA drive the radio uses at each MHz, per power level.',
    about:
      'Made-up data for the styleguide. Real radios describe their own index rule and sources here, so the long text can run to several lines and folds behind More.',
    address: band.id === 'vhf' ? '0x1000–0x103F' : '0x1040–0x107F',
    confidence: { layout: 'traced', meaning: 'partially-traced' },
    x: { label: 'Frequency', unit: 'MHz' },
    y: { label: 'Drive', unit: 'raw' },
    series,
    table: {
      key: { label: 'MHz' },
      rows: xs.map((x, i) => ({
        key: String(x),
        ...(i === Math.floor(xs.length / 2) ? { mark: 'reference' as const } : {}),
      })),
      columns: series.map((s) => ({
        id: s.id,
        label: s.label,
        values: s.points.map((p) => p.y),
        width: 1 as const,
        deltaFromRow: Math.floor(xs.length / 2),
      })),
    },
  };
}

function debugDemoSquelch(shift: number): StepBars {
  const bars = Array.from({ length: 10 }, (_, i) => ({
    id: `sq-${i}`,
    label: String(i),
    value: 20 + i * 11 + shift * (i % 3),
  }));
  return {
    kind: 'step-bars',
    id: 'squelch',
    title: 'Squelch ladder',
    meaning: 'Threshold the radio opens at for each squelch level.',
    address: '0x1100–0x1109',
    confidence: { layout: 'traced', meaning: 'traced' },
    x: { label: 'Squelch level' },
    y: { label: 'Threshold', unit: 'raw', domain: 'auto' },
    bars,
    table: {
      key: { label: 'Level' },
      rows: bars.map((b) => ({ key: b.label })),
      columns: [
        {
          id: 'threshold',
          label: 'Threshold',
          values: bars.map((b) => b.value),
          width: 1 as const,
        },
      ],
    },
  };
}

function debugDemoBattery(shift: number): BatteryLadder {
  const steps = [6.6, 6.9, 7.1, 7.4, 7.7, 8.2].map((volts, i) => ({
    id: `bat-${i}`,
    label: `Step ${i + 1}`,
    raw: 0x80 + i * 9 + shift,
    volts,
  }));
  return {
    kind: 'battery',
    id: 'battery',
    title: 'Battery ladder',
    meaning: 'ADC reading at which each battery bar is drawn.',
    address: '0x1200–0x1205',
    confidence: { layout: 'partially-traced', meaning: 'inferred' },
    steps,
    table: {
      key: { label: 'Step' },
      rows: steps.map((s) => ({ key: s.label })),
      columns: [
        { id: 'raw', label: 'Reading', values: steps.map((s) => s.raw), width: 1 as const },
      ],
    },
  };
}

function debugDemoTrim(
  id: string,
  title: string,
  raw: number,
  withPpm: boolean,
  shift: number,
): TrimView {
  return {
    kind: 'trim',
    id,
    title,
    meaning: 'Reference oscillator trim.',
    address: id === 'trim-ppm' ? '0x1300' : '0x1301',
    confidence: { layout: 'traced', meaning: withPpm ? 'traced' : 'unknown' },
    raw: raw + shift,
    scale: { min: 0, max: 16, neutral: 8 },
    ppm: withPpm ? { perStep: 1, span: 8 } : undefined,
    table: {
      key: { label: 'Field' },
      rows: [{ key: 'Trim' }],
      columns: [{ id: 'raw', label: 'Raw', values: [raw + shift], width: 1 as const }],
    },
  };
}

/** The demo's calibration charts for one read (`overlay` shifts every value a little). */
export function debugDemoCharts(overlay = false): CalibrationChart[] {
  return [
    ...DEBUG_DEMO_BANDS.map((band) => debugDemoPowerCurve(band, overlay ? 3 : 0)),
    debugDemoSquelch(overlay ? 2 : 0),
    debugDemoBattery(overlay ? 2 : 0),
    debugDemoTrim('trim-ppm', 'Reference trim (ppm known)', 10, true, overlay ? 1 : 0),
    debugDemoTrim('trim-raw', 'Reference trim (no ppm scale)', 7, false, overlay ? 1 : 0),
  ];
}

export function debugDemoValueTable(overlay = false): ValueTableView {
  const bump = overlay ? 1 : 0;
  return {
    id: 'demo-values',
    title: 'Production record',
    description: 'Fields the factory writes once; the demo radio is made up.',
    layout: 'single',
    rows: [
      {
        id: 'version',
        label: 'Hardware version',
        group: 'Header',
        address: '0x0000',
        cells: [
          {
            decoded: overlay ? 'V1.62' : 'V1.61',
            raw: new Uint8Array([1, overlay ? 0x3e : 0x3d]),
            availability: 'captured',
          },
        ],
        confidence: { layout: 'traced', meaning: 'traced' },
        source: 'Made-up layout notes',
      },
      {
        id: 'gain',
        label: 'Receiver gain code',
        group: 'Receiver',
        address: '+0x004',
        cells: [{ value: 26 + bump, availability: 'captured' }],
        confidence: { layout: 'traced', meaning: 'inferred' },
      },
      {
        id: 'channels',
        label: 'Channels configured',
        group: 'Counts',
        cells: [{ value: 128, format: 'decimal', unit: 'channels', availability: 'captured' }],
      },
      {
        id: 'ref-freq',
        label: 'Reference frequency',
        group: 'Receiver',
        cells: [{ value: 12_800, format: 'decimal', unit: 'kHz', availability: 'captured' }],
        note: 'A reference row: the value every other row is measured against.',
      },
      {
        id: 'secret',
        label: 'Service password',
        group: 'Privacy',
        address: '+0x010',
        cells: [
          {
            value: 1234,
            raw: new Uint8Array([0x31, 0x32, 0x33, 0x34]),
            sensitive: true,
            availability: 'captured',
          },
        ],
      },
      {
        id: 'missing',
        label: 'Serial block',
        group: 'Header',
        cells: [{ availability: 'not-captured' }],
      },
    ],
  };
}

function debugDemoSettingRows(overlay: boolean): SettingRow[] {
  return [
    {
      id: 'backlight',
      label: 'Backlight time',
      help: '0 Always on, 1–9 seconds ×5',
      value: overlay ? '10 s' : '5 s',
      rawValue: overlay ? 2 : 1,
      firmwareDefault: '5 s',
      confidence: 'traced',
      evidence: 'Made-up firmware 1.0',
      address: '0x0040',
      raw: [overlay ? 0x02 : 0x01],
    },
    {
      id: 'beep',
      label: 'Key beep',
      help: '0 Off, 1 On',
      value: 'On',
      rawValue: 1,
      firmwareDefault: 'On',
      confidence: 'partially-traced',
      address: '0x0041',
      raw: [0x01],
    },
    {
      id: 'squelch-default',
      label: 'Default squelch level',
      value: '3',
      firmwareDefault: '3',
      confidence: 'inferred',
      address: '0x0042',
      raw: [0x03],
    },
    {
      id: 'vox',
      label: 'VOX delay',
      value: undefined,
      firmwareDefault: '1.0 s',
      confidence: 'unknown',
      address: '0x0043',
    },
    {
      id: 'password',
      label: 'Power-on password',
      help: 'Four digits',
      value: '1234',
      firmwareDefault: 'None',
      confidence: 'traced',
      address: '0x0050',
      raw: [0x31, 0x32, 0x33, 0x34],
      sensitive: true,
    },
  ];
}

export function debugDemoSettingsView(overlay = false): SettingsView {
  const rows = debugDemoSettingRows(overlay);
  return {
    status: { kind: 'ok' },
    summary: `${rows.length} of ${rows.length} known setting fields captured · 4 decoded · 1 not captured`,
    intro:
      'Made-up settings for the styleguide, with the firmware default beside each value so a changed setting stands out.',
    groups: [
      { id: 'display', label: 'Display & audio', rows: rows.slice(0, 2) },
      { id: 'radio', label: 'Radio', rows: rows.slice(2, 4) },
      { id: 'privacy', label: 'Privacy', rows: rows.slice(4) },
      {
        id: 'scan',
        label: 'Scan',
        emptyText: 'No scan settings are decoded for this radio yet.',
        rows: [],
      },
    ],
    trailing: [
      {
        id: 'unused',
        title: 'Unused bytes',
        description: 'Captured bytes no field edits.',
        rows: [
          {
            id: 'pad',
            label: 'Padding',
            value: 'Unused (no reader)',
            confidence: 'unused',
            address: '0x0060',
            raw: [0xff, 0xff],
          },
        ],
      },
    ],
  };
}

export const DEBUG_DEMO_UNUSED: UnusedRange[] = [
  { start: '0x1400', end: '0x14FF', bytes: 256, why: 'Never read by the demo firmware.' },
  { start: '0x1600', end: '0x160F', bytes: 16, why: 'Reserved.' },
];

export const DEBUG_DEMO_NOTICE: EvidenceNoticeView = {
  title: 'Not validated on hardware',
  lines: [
    'This layout comes from made-up notes and a synthetic read.',
    'Treat every value as a hint until it is checked against a real radio.',
  ],
  tone: 'caution',
};

export const DEBUG_DEMO_HEX: HexSource[] = [
  {
    id: 'demo-image',
    label: 'Demo image',
    address: 0x1000,
    bytes: Uint8Array.from({ length: 96 }, (_, i) => (i < 48 ? 0xff : (i * 7) & 0xff)),
    sensitive: [{ start: 0x1050, length: 4 }],
  },
];

export const DEBUG_DEMO_READS = [
  { id: 'read-a', label: 'Demo read A', time: new Date('2026-01-01T10:00:00Z') },
  { id: 'read-b', label: 'Demo read B', time: new Date('2026-01-02T09:30:00Z') },
];

export interface DebugDemoMemoryRow {
  id: string;
  slot: number;
  callsign: string;
  name: string;
  rx: number;
  tx: number;
  tone: string;
}

export const DEBUG_DEMO_MEMORY_ROWS: DebugDemoMemoryRow[] = [
  { id: '1', slot: 1, callsign: 'GB3DA', name: 'Stornoway', rx: 145.6, tx: 145.0, tone: '77.0 Hz' },
  {
    id: '2',
    slot: 2,
    callsign: 'GB3IV',
    name: 'Inverness',
    rx: 145.725,
    tx: 145.125,
    tone: '77.0 Hz',
  },
  { id: '3', slot: 3, callsign: '', name: 'Simplex calling', rx: 145.5, tx: 145.5, tone: 'None' },
  { id: '4', slot: 4, callsign: 'GB7GM', name: 'Glasgow', rx: 439.7, tx: 430.3, tone: '110.9 Hz' },
];

export const DEBUG_DEMO_MEMORY_CAVEAT = [
  'Each identity is the callsign and name together; a slot with no callsign shows its name alone.',
  'Slots keep their radio numbers; sorting never renumbers them.',
  'Frequencies are shown in MHz.',
];
