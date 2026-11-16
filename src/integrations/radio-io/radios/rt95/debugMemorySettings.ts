/**
 * Read-only RT95 radio-settings inventory projected from a captured clone image.
 *
 * Every field registered for Write overrides (`settingsFields.ts`) is decoded from the clone
 * image and returned with its address, raw bytes, decoded value, trust tag and targets. Bytes
 * inside the two settings windows that no field claims are returned as named runs (a meaning, or
 * unused with no reader; read-only, never part of the Write registry). A field is
 * shown only when every byte of its span was captured; nothing is gap-filled.
 */
import {
  RT95_SETTING_SECTIONS,
  rt95SettingField,
  rt95SettingValueLabel,
  type Rt95SettingSectionId,
} from '@core/radios/retevis/rt95/radioSettings.ts';
import { RT95_SETTINGS_FIELDS, type Rt95SettingsTarget } from './settingsFields.ts';

export const RT95_SETTINGS_GROUPS = RT95_SETTING_SECTIONS;

/** Windows of the clone image that carry settings: 0x1980-0x1AFF and 0x3200-0x327F (512 bytes). */
export const RT95_SETTINGS_WINDOWS: readonly { start: number; end: number }[] = [
  { start: 0x1980, end: 0x1b00 },
  { start: 0x3200, end: 0x3280 },
];

/** Ids whose raw bytes and value are a secret and stay masked until the operator reveals them. */
const SENSITIVE_FIELD_IDS: ReadonlySet<string> = new Set(['powerOnPasswordDigits']);

export interface Rt95SettingFieldView {
  id: string;
  label: string;
  help: string;
  group: Rt95SettingSectionId;
  address: number;
  length: number;
  mask?: number;
  advanced: boolean;
  trust: string;
  targets: readonly Rt95SettingsTarget[];
  status: 'captured' | 'not-captured';
  /** Decoded value text; `undefined` when the bytes are not interpreted. */
  value?: string;
  raw?: number[];
  /** True for the power-on password: hide `value` and `raw` until revealed. */
  sensitive: boolean;
}

/** Confidence for bytes outside the Write registry: traced, partly (inferred or CPS only), unused. */
export type Rt95RunConfidence = 'traced' | 'partly' | 'unused' | 'unknown';

export interface Rt95UnclaimedRun {
  address: number;
  raw?: number[];
  length: number;
  /** What the run is; `unknown` only for a byte the research does not cover. */
  label: string;
  confidence: Rt95RunConfidence;
  /** Evidence (function address, CPS ini or ledger id) and caveats such as "names inferred". */
  note?: string;
  /** Read-only interpretation of the raw bytes, when cheap. */
  decoded?: string;
}

interface RunSpec {
  address: number;
  length: number;
  label: string;
  confidence: Rt95RunConfidence;
  note?: string;
  decode?: (bytes: Uint8Array) => string;
}

const unusedRun = (address: number, length: number, note: string): RunSpec => ({
  address,
  length,
  label: 'Unused (no reader)',
  confidence: 'unused',
  note,
});

const yesNo = (v: number, bit: number) => ((v >> bit) & 1 ? 'on' : 'off');

/**
 * The 135 bytes of the two settings windows that no registered field claims, as explained by the
 * static MAIN V1.61 / head V1.41 / CPS 2.01 decode: 42 bytes with a meaning, 93 read by nothing.
 * Debug view only; none of these is writable. Names marked inferred are not proven.
 */
const RUN_SPECS: readonly RunSpec[] = [
  unusedRun(0x1987, 9, 'power-on text is 7 bytes; MAIN reads 7'),
  {
    address: 0x1abe,
    length: 2,
    label: 'Stun string digits 15-16',
    confidence: 'traced',
    note: 'MAIN reads 16 bytes (0x08007790), CPS fills 0xFF past 14; F127',
  },
  {
    address: 0x1ace,
    length: 2,
    label: 'Kill string digits 15-16',
    confidence: 'traced',
    note: 'MAIN reads 16 bytes (0x08007790), CPS fills 0xFF past 14; F127',
  },
  {
    address: 0x1ad5,
    length: 1,
    label: 'DTMF auto reset time',
    confidence: 'partly',
    note: 'seconds per the CPS ini; settings.md, not traced in firmware',
    decode: (b) => `${b[0]} (raw, seconds)`,
  },
  unusedRun(0x1adc, 4, 'MAIN reads 12'),
  {
    address: 0x1ae0,
    length: 24,
    label: 'Tone group 0',
    confidence: 'traced',
    note: 'F127 layout; byte 0 is the decode function index 0-6 (3 and 4 set 0x3B10 bits 3 and 2, 5 clears them); function names inferred; MAIN 0x0800733E, 0x080063AE',
    decode: (b) => {
      const f = b[0]!;
      const suffix =
        f === 3 || f === 4 ? ' (sets a remote-lock bit)' : f === 5 ? ' (clears them)' : '';
      return f > 6 ? `decode function ${f} (outside 0-6)` : `decode function ${f}${suffix}`;
    },
  },
  unusedRun(0x1af8, 8, 'unread tail of tone group 0'),
  unusedRun(0x3203, 1, 'F124'),
  {
    address: 0x3212,
    length: 1,
    label: 'Hand-mic key brightness',
    confidence: 'partly',
    note: 'Off = 0, 1-31; F124, not traced in firmware',
    decode: (b) => (b[0] === 0 ? 'Off' : `level ${b[0]}`),
  },
  {
    address: 0x3214,
    length: 4,
    label: 'Mic keys PA-PD',
    confidence: 'partly',
    note: 'CPS and CHIRP encodings disagree; settings.md',
  },
  {
    address: 0x321f,
    length: 1,
    label: 'Mic level',
    confidence: 'partly',
    note: '0-2 maps to RF register 0x44 TX gain; F124, F142',
    decode: (b) => `level ${b[0]} (raw 0-2)`,
  },
  unusedRun(0x3220, 32, 'F126 + address scan'),
  unusedRun(0x3246, 10, 'MAIN reads 6'),
  unusedRun(0x325c, 4, 'MAIN reads 12'),
  ...(
    [
      [0x3260, 'Side A', 0x3261],
      [0x3267, 'Side B', 0x3268],
    ] as const
  ).flatMap(([channel, side, flags]): RunSpec[] => [
    {
      address: channel,
      length: 1,
      label: `${side} channel index`,
      confidence: 'traced',
      note: 'MAIN 0x080075CA',
      decode: (b) => `index ${b[0]} (raw)`,
    },
    {
      address: flags,
      length: 1,
      label: `${side} flags`,
      confidence: 'traced',
      note: 'bit 0 VFO, bit 1 no write-back, bit 3 TRF channel (0x3280) when 0x321B bit 1 is on; MAIN 0x08007400',
      decode: (b) =>
        `VFO ${yesNo(b[0]!, 0)}, no write-back ${yesNo(b[0]!, 1)}, TRF channel ${yesNo(b[0]!, 3)}`,
    },
  ]),
  unusedRun(0x3262, 5, 'F126 + address scan'),
  unusedRun(0x3269, 4, 'F126 + address scan'),
  {
    address: 0x326d,
    length: 1,
    label: 'Band copy (never a setting)',
    confidence: 'traced',
    note: 'compared with 0x3B0F; F25, F120',
    decode: (b) => `${b[0]} (raw)`,
  },
  {
    address: 0x326e,
    length: 2,
    label: 'DTMF memory in-use mask',
    confidence: 'partly',
    note: 'F127; settings.md',
  },
  unusedRun(0x3270, 16, 'F126 + address scan'),
];

export interface Rt95SettingsInventory {
  fields: Rt95SettingFieldView[];
  unclaimed: Rt95UnclaimedRun[];
  counts: {
    registered: number;
    captured: number;
    decoded: number;
    windowBytes: number;
    claimedBytes: number;
    unclaimedBytes: number;
    /** Of the unclaimed bytes: with a meaning, unused (no reader), and not covered by the research. */
    meaningBytes: number;
    unusedBytes: number;
    unknownBytes: number;
  };
}

function valueText(id: string, value: number | boolean | string): string {
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (typeof value === 'number') {
    const def = rt95SettingField(id);
    return (def && rt95SettingValueLabel(def, value)) ?? String(value);
  }
  return value === '' ? '(empty)' : value;
}

export function projectRt95Settings(
  image: Uint8Array | undefined,
  base = 0,
): Rt95SettingsInventory {
  const at = (address: number, length: number) =>
    image && address >= base && address + length <= base + image.length
      ? image.subarray(address - base, address - base + length)
      : undefined;
  const fields: Rt95SettingFieldView[] = [];
  const claimed = new Set<number>();
  for (const spec of RT95_SETTINGS_FIELDS.values()) {
    for (let i = 0; i < spec.length; i++) claimed.add(spec.address + i);
    const def = rt95SettingField(spec.id);
    const bytes = at(spec.address, spec.length);
    const decoded = bytes ? spec.decode(bytes) : undefined;
    fields.push({
      id: spec.id,
      label: def?.label ?? spec.id,
      help: def?.help ?? '',
      group: def?.section ?? 'advanced',
      address: spec.address,
      length: spec.length,
      ...(spec.mask === undefined ? {} : { mask: spec.mask }),
      advanced: spec.advanced,
      trust: spec.trust,
      targets: spec.targets,
      status: bytes ? 'captured' : 'not-captured',
      ...(decoded === undefined ? {} : { value: valueText(spec.id, decoded) }),
      ...(bytes ? { raw: [...bytes] } : {}),
      sensitive: SENSITIVE_FIELD_IDS.has(spec.id),
    });
  }
  fields.sort((a, b) => a.address - b.address || (a.mask ?? 0) - (b.mask ?? 0));

  const specAt = new Map<number, RunSpec>();
  for (const spec of RUN_SPECS)
    for (let i = 0; i < spec.length; i++) specAt.set(spec.address + i, spec);
  const unclaimed: Rt95UnclaimedRun[] = [];
  let windowBytes = 0;
  let claimedBytes = 0;
  const emit = (address: number, length: number, spec: RunSpec | undefined) => {
    const raw = at(address, length);
    const decoded = raw && spec?.decode ? spec.decode(raw) : undefined;
    unclaimed.push({
      address,
      length,
      label: spec?.label ?? 'Unknown',
      confidence: spec?.confidence ?? 'unknown',
      ...(spec?.note ? { note: spec.note } : {}),
      ...(decoded === undefined ? {} : { decoded }),
      ...(raw ? { raw: [...raw] } : {}),
    });
  };
  for (const { start, end } of RT95_SETTINGS_WINDOWS) {
    windowBytes += end - start;
    let runStart = -1;
    let runSpec: RunSpec | undefined;
    for (let a = start; a <= end; a++) {
      const free = a < end && !claimed.has(a);
      if (a < end && !free) claimedBytes++;
      const spec = free ? specAt.get(a) : undefined;
      if (runStart >= 0 && (!free || spec !== runSpec)) {
        emit(runStart, a - runStart, runSpec);
        runStart = -1;
      }
      if (free && runStart < 0) {
        runStart = a;
        runSpec = spec;
      }
    }
  }
  const sumBy = (c: Rt95RunConfidence[]) =>
    unclaimed.filter((r) => c.includes(r.confidence)).reduce((n, r) => n + r.length, 0);
  return {
    fields,
    unclaimed,
    counts: {
      registered: fields.length,
      captured: fields.filter((f) => f.status === 'captured').length,
      decoded: fields.filter((f) => f.value !== undefined).length,
      windowBytes,
      claimedBytes,
      unclaimedBytes: windowBytes - claimedBytes,
      meaningBytes: sumBy(['traced', 'partly']),
      unusedBytes: sumBy(['unused']),
      unknownBytes: sumBy(['unknown']),
    },
  };
}
