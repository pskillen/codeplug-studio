/**
 * Read-only DM-32UV radio-settings view projected from a sparse capture.
 *
 * The settings page is the single accepted block tagged `0x04`. The layout is the stock
 * DM32.01.L01.048 layout in `docs/reference/radios/baofeng/dm-32uv/settings.md`, verified against
 * synthetic fixtures only, not hardware. A field is decoded only when its whole span was captured;
 * nothing is gap-filled and nothing is inferred about firmware or mods. Emergency systems and
 * encryption keys (tag `0x10`) are deliberately outside this view.
 */
import { DM32_METADATA } from './constants.ts';
import type { Dm32SparseCapture } from './debugMemory.ts';
import { dm32PageByStoredTag, dm32TagHex } from './debugMemoryLists.ts';
import { dm32KeyFunctionLabel } from './retainPreview.ts';

/** Only the first `0x508` bytes of the page carry layout. */
export const DM32_SETTINGS_LAYOUT_LENGTH = 0x508;

export const DM32_SETTINGS_LAYOUT_BASIS =
  'stock DM32.01.L01.048 layout, verified against synthetic fixtures only, not hardware';

export const DM32_SETTINGS_GROUPS = [
  { id: 'display', label: 'Display' },
  { id: 'power', label: 'Power & battery' },
  { id: 'keys', label: 'Keys & buttons' },
  { id: 'gps', label: 'GPS / APRS' },
  { id: 'privacy', label: 'Privacy / lock' },
  { id: 'other', label: 'Other' },
] as const;

export type Dm32SettingsGroupId = (typeof DM32_SETTINGS_GROUPS)[number]['id'];

interface FieldSpec {
  id: string;
  group: Dm32SettingsGroupId;
  label: string;
  offset: number;
  length: number;
  /** Bits of the (single) byte this field owns. */
  mask?: number;
  /** Text for a decoded value; `undefined` leaves the value raw. Receives the masked span. */
  decode(bytes: Uint8Array): string | undefined;
  /** Where in `settings.md` the field is documented. */
  source: string;
  help?: string;
}

type FieldInput = Omit<FieldSpec, 'source' | 'decode'> & Partial<Pick<FieldSpec, 'decode'>>;

const SRC = 'settings.md';
const AUTO_POWER_OFF = ['Off', '30 minutes', '1 hour', '2 hours', '3 hours', '4 hours'] as const;

/** Bytes up to the first NUL, at most the span: not trimmed, not stopped at 0xFF. */
function asciiToNul(bytes: Uint8Array): string {
  let end = 0;
  while (end < bytes.length && bytes[end] !== 0x00) end++;
  return new TextDecoder('latin1').decode(bytes.subarray(0, end));
}

const u8 = (b: Uint8Array) => String(b[0]);
const onOff = (b: Uint8Array) => (b[0] ? 'On' : 'Off');
const u16le = (b: Uint8Array) => b[0]! | (b[1]! << 8);
const u24le = (b: Uint8Array) => b[0]! | (b[1]! << 8) | (b[2]! << 16);
const keyFunction = (b: Uint8Array) => `${dm32KeyFunctionLabel(b[0]!)} (${b[0]})`;
const letter = (allowed: readonly string[]) => (b: Uint8Array) => {
  const c = String.fromCharCode(b[0]!);
  return allowed.includes(c) ? c : undefined;
};

const field = (spec: FieldInput, line: string): FieldSpec => ({
  decode: () => undefined,
  source: `${SRC}: ${line}`,
  ...spec,
});

const reportChannel = (n: number): FieldSpec =>
  field(
    {
      id: `aprs-report-channel-${n}`,
      group: 'gps',
      label: `APRS report channel ${n}`,
      offset: 0x320 + (n - 1) * 2,
      length: 2,
      decode: (b) => (u16le(b) === 0 ? '0 (current channel)' : String(u16le(b))),
    },
    'APRS table, 0x320-0x32F',
  );

const keyField = (id: string, label: string, offset: number): FieldSpec =>
  field(
    { id, group: 'keys', label, offset, length: 1, decode: keyFunction },
    `key-function codes, 0x${offset.toString(16).toUpperCase()}`,
  );

/** The registry: documented fields only. */
export const DM32_SETTINGS_FIELDS: readonly FieldSpec[] = [
  field(
    {
      id: 'power-on-interface',
      group: 'display',
      label: 'Power-on interface (raw value)',
      offset: 0x00,
      length: 1,
      decode: u8,
    },
    'highlights, 0x00',
  ),
  field(
    {
      id: 'power-on-line-1',
      group: 'display',
      label: 'Power-on display line 1',
      offset: 0x01,
      length: 14,
      decode: asciiToNul,
    },
    'highlights, 0x01',
  ),
  field(
    {
      id: 'power-on-line-2',
      group: 'display',
      label: 'Power-on display line 2',
      offset: 0x0f,
      length: 14,
      decode: asciiToNul,
    },
    'highlights, 0x0F',
  ),
  field(
    {
      id: 'allow-reset',
      group: 'other',
      label: 'Allow reset',
      offset: 0x1d,
      length: 1,
      mask: 0x01,
      decode: onOff,
    },
    'highlights, 0x1D bit 0',
  ),
  field(
    {
      id: 'auto-power-off',
      group: 'power',
      label: 'Auto power off',
      offset: 0x1e,
      length: 1,
      decode: (b) => AUTO_POWER_OFF[b[0]!],
    },
    'highlights, 0x1E (0-5 enum)',
  ),
  field(
    {
      id: 'gps-enable',
      group: 'gps',
      label: 'GPS',
      offset: 0x40,
      length: 1,
      mask: 0x01,
      decode: onOff,
    },
    'highlights, 0x40-0x45 (enable bit 0 only)',
  ),
  field(
    {
      id: 'gps-other',
      group: 'gps',
      label: 'GPS block 0x41-0x45 (raw)',
      offset: 0x41,
      length: 5,
      help: 'Documented roles: units, mode, UTC, report interval. Which byte holds which role is not established.',
    },
    'highlights, 0x40-0x45',
  ),
  field(
    { id: 'key-lock', group: 'privacy', label: 'Key lock', offset: 0x85, length: 1, decode: onOff },
    'highlights, 0x85',
  ),
  field(
    {
      id: 'auto-lock-delay',
      group: 'privacy',
      label: 'Auto-lock delay (raw value)',
      offset: 0x86,
      length: 1,
      decode: u8,
    },
    'highlights, 0x86',
  ),
  keyField('side-key-1-short', 'Side key 1, short press', 0x87),
  keyField('side-key-1-long', 'Side key 1, long press', 0x88),
  keyField('side-key-2-short', 'Side key 2, short press', 0x89),
  keyField('side-key-2-long', 'Side key 2, long press', 0x8a),
  field(
    {
      id: 'key-function-8b-8c',
      group: 'keys',
      label: 'Key functions 0x8B-0x8C (raw)',
      offset: 0x8b,
      length: 2,
      help: 'Inside the documented key-function range, but which key they belong to is not established.',
    },
    'highlights, 0x87-0x90',
  ),
  keyField('prog-key-1-short', 'Programmable key 1, short press', 0x8d),
  keyField('prog-key-1-long', 'Programmable key 1, long press', 0x8e),
  keyField('prog-key-2-short', 'Programmable key 2, short press', 0x8f),
  keyField('prog-key-2-long', 'Programmable key 2, long press', 0x90),
  field(
    {
      id: 'long-press',
      group: 'keys',
      label: 'Long-press (raw value)',
      offset: 0x93,
      length: 1,
      decode: u8,
    },
    'highlights, 0x93',
  ),
  field(
    {
      id: 'aprs-scheduled-send',
      group: 'gps',
      label: 'APRS scheduled send time (raw value)',
      offset: 0x301,
      length: 1,
      decode: u8,
    },
    'APRS table, 0x301',
  ),
  field(
    {
      id: 'aprs-fixed-beacon',
      group: 'gps',
      label: 'APRS fixed beacon',
      offset: 0x302,
      length: 1,
      mask: 0x01,
      decode: onOff,
    },
    'APRS table, 0x302 bit 0',
  ),
  field(
    {
      id: 'aprs-latitude',
      group: 'gps',
      label: 'APRS latitude (string)',
      offset: 0x306,
      length: 9,
      decode: asciiToNul,
    },
    'APRS table, 0x306',
  ),
  field(
    {
      id: 'aprs-latitude-ns',
      group: 'gps',
      label: 'APRS latitude N/S',
      offset: 0x30f,
      length: 1,
      decode: letter(['N', 'S']),
    },
    'APRS table, 0x30F',
  ),
  field(
    {
      id: 'aprs-longitude',
      group: 'gps',
      label: 'APRS longitude (string)',
      offset: 0x310,
      length: 9,
      decode: asciiToNul,
    },
    'APRS table, 0x310',
  ),
  field(
    {
      id: 'aprs-longitude-ew',
      group: 'gps',
      label: 'APRS longitude E/W',
      offset: 0x319,
      length: 1,
      decode: letter(['E', 'W']),
    },
    'APRS table, 0x319',
  ),
  ...[1, 2, 3, 4, 5, 6, 7, 8].map(reportChannel),
  field(
    {
      id: 'aprs-repeater-delay',
      group: 'gps',
      label: 'APRS repeater active delay (raw value)',
      offset: 0x330,
      length: 1,
      decode: u8,
    },
    'APRS table, 0x330',
  ),
  field(
    {
      id: 'aprs-call-type',
      group: 'gps',
      label: 'APRS call type (bit 0)',
      offset: 0x331,
      length: 1,
      mask: 0x01,
      decode: (b) => `Bit 0 = ${b[0]} (meaning not established)`,
    },
    'APRS table, 0x331 bit 0',
  ),
  field(
    {
      id: 'aprs-upload-id',
      group: 'gps',
      label: 'APRS upload DMR ID (24-bit little-endian)',
      offset: 0x332,
      length: 3,
      decode: (b) => String(u24le(b)),
    },
    'APRS table, 0x332-0x334',
  ),
];

export interface Dm32DocumentedRange {
  id: string;
  label: string;
  offset: number;
  length: number;
  source: string;
}

const range = (
  id: string,
  label: string,
  offset: number,
  length: number,
  line: string,
): Dm32DocumentedRange => ({ id, label, offset, length, source: `${SRC}: ${line}` });

/** Documented in `settings.md` but with no decode here: shown raw. */
export const DM32_SETTINGS_DOCUMENTED_RANGES: readonly Dm32DocumentedRange[] = [
  range('alert-tones', 'Alert tone flags', 0x20, 2, 'highlights, 0x20-0x21'),
  range(
    'display-0x30',
    'Backlight, display flags, colours, menu exit',
    0x30,
    12,
    'highlights, 0x30-0x3B',
  ),
  range(
    'digital-0x60',
    'Digital decode / call hold / SMS / name display',
    0x60,
    8,
    'highlights, 0x60-0x67',
  ),
  range('vfo-0x80', 'VFO embedded flags / TX dwell', 0x80, 2, 'highlights, 0x80-0x81'),
  range(
    'one-key-call',
    'Analog one-key call entries (extent not stated; taken to end before 0x200)',
    0x120,
    0xe0,
    'highlights, 0x120',
  ),
  range('one-touch-call', 'One-touch call (5 x 5 bytes)', 0x200, 25, 'highlights, 0x200'),
  range('fun-plus', 'Fun+ entries (10 x 7 bytes)', 0x230, 70, 'highlights, 0x230'),
  range('menu-flags', 'Menu enable/disable bitflags', 0x500, 8, 'highlights, 0x500-0x507'),
];

export interface Dm32SettingFieldView {
  id: string;
  group: Dm32SettingsGroupId;
  label: string;
  /** Offset within the page. */
  offset: number;
  /** Address in the archive. */
  address: number;
  length: number;
  mask?: number;
  help?: string;
  source: string;
  status: 'captured' | 'not-captured';
  /** Raw bytes, unmasked; absent when not captured. */
  raw?: number[];
  /** Decoded text; absent when the value is not interpreted (shown raw). */
  value?: string;
}

export interface Dm32DocumentedRangeView {
  id: string;
  label: string;
  offset: number;
  address: number;
  length: number;
  source: string;
  status: 'captured' | 'not-captured';
  raw?: number[];
}

export interface Dm32UnknownRun {
  offset: number;
  address: number;
  raw: number[];
}

export interface Dm32SettingsCounts {
  registered: number;
  captured: number;
  decoded: number;
  documentedRanges: number;
  documentedRangesCaptured: number;
  /** Captured bytes in the layout covered by no field or documented range. */
  unknownBytes: number;
}

export type Dm32SettingsInventory =
  | { status: 'not-captured'; reason: string }
  | { status: 'ambiguous'; reason: string; addresses: number[] }
  | {
      status: 'captured';
      /** Archive address of the single `0x04` page. */
      address: number;
      fields: Dm32SettingFieldView[];
      documented: Dm32DocumentedRangeView[];
      unknown: Dm32UnknownRun[];
      counts: Dm32SettingsCounts;
    };

const span = (page: Uint8Array, offset: number, length: number) =>
  Array.from(page.subarray(offset, offset + length));

export function projectDm32Settings(capture: Dm32SparseCapture): Dm32SettingsInventory {
  const tag = DM32_METADATA.VFO_SETTINGS;
  const lookup = dm32PageByStoredTag(capture, tag);
  if (lookup.kind === 'none')
    return {
      status: 'not-captured',
      reason: `No accepted block tagged ${dm32TagHex(tag)} was captured.`,
    };
  if (lookup.kind === 'several')
    return {
      status: 'ambiguous',
      reason: `Several pages tagged ${dm32TagHex(tag)}, not decoded.`,
      addresses: lookup.addresses,
    };
  const { page, address } = lookup;
  const readable = (offset: number, length: number) =>
    offset + length <= page.length && capture.covers(address + offset, length);

  const claimed = new Uint8Array(DM32_SETTINGS_LAYOUT_LENGTH);
  const claim = (offset: number, length: number) => claimed.fill(1, offset, offset + length);

  const fields: Dm32SettingFieldView[] = DM32_SETTINGS_FIELDS.map((spec) => {
    claim(spec.offset, spec.length);
    const base = {
      id: spec.id,
      group: spec.group,
      label: spec.label,
      offset: spec.offset,
      address: address + spec.offset,
      length: spec.length,
      mask: spec.mask,
      help: spec.help,
      source: spec.source,
    };
    if (!readable(spec.offset, spec.length)) return { ...base, status: 'not-captured' };
    const bytes = page.slice(spec.offset, spec.offset + spec.length);
    const masked = spec.mask === undefined ? bytes : Uint8Array.of(bytes[0]! & spec.mask);
    return { ...base, status: 'captured', raw: Array.from(bytes), value: spec.decode(masked) };
  });

  const documented: Dm32DocumentedRangeView[] = DM32_SETTINGS_DOCUMENTED_RANGES.map((r) => {
    claim(r.offset, r.length);
    const base = { ...r, address: address + r.offset };
    return readable(r.offset, r.length)
      ? { ...base, status: 'captured', raw: span(page, r.offset, r.length) }
      : { ...base, status: 'not-captured' };
  });

  const unknown: Dm32UnknownRun[] = [];
  let unknownBytes = 0;
  for (let offset = 0; offset < DM32_SETTINGS_LAYOUT_LENGTH;) {
    if (claimed[offset] || !readable(offset, 1)) {
      offset++;
      continue;
    }
    let end = offset;
    while (end < DM32_SETTINGS_LAYOUT_LENGTH && !claimed[end] && readable(end, 1)) end++;
    unknown.push({ offset, address: address + offset, raw: span(page, offset, end - offset) });
    unknownBytes += end - offset;
    offset = end;
  }

  return {
    status: 'captured',
    address,
    fields,
    documented,
    unknown,
    counts: {
      registered: fields.length,
      captured: fields.filter((x) => x.status === 'captured').length,
      decoded: fields.filter((x) => x.value !== undefined).length,
      documentedRanges: documented.length,
      documentedRangesCaptured: documented.filter((x) => x.status === 'captured').length,
      unknownBytes,
    },
  };
}
