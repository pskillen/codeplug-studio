/**
 * Read-only DM-32UV radio-settings view projected from a sparse capture.
 *
 * The settings page is the single accepted block tagged `0x04`. The layout is the stock
 * DM32.01.L01.048 layout in `docs/reference/radios/baofeng/dm-32uv/settings.md`, traced by static
 * analysis of the stock image and verified against synthetic fixtures only, not hardware. A field
 * is decoded only when its whole span was captured; nothing is gap-filled and nothing is inferred
 * about firmware or mods. Emergency systems and encryption keys (tag `0x10`) are deliberately
 * outside this view.
 *
 * Confidence: `traced` is a code address in 048; `partially-traced` is a traced offset or
 * arithmetic whose name or unit rests on the vendor CPS label order ("inferred"); `unknown` is a
 * traced layout whose name is only a guess. Bytes nothing in 048 reads are listed as unused.
 */
import { DM32_METADATA } from './constants.ts';
import type { Dm32SparseCapture } from './debugMemory.ts';
import { dm32PageByStoredTag, dm32TagHex } from './debugMemoryLists.ts';
import { dm32KeyFunctionLabel } from './retainPreview.ts';

/** Only the first `0x508` bytes of the page carry layout. */
export const DM32_SETTINGS_LAYOUT_LENGTH = 0x508;

export const DM32_SETTINGS_LAYOUT_BASIS =
  'stock DM32.01.L01.048 layout, traced by static analysis and verified against synthetic fixtures only, not hardware';

export const DM32_SETTINGS_GROUPS = [
  { id: 'display', label: 'Display' },
  { id: 'tones', label: 'Tones & alerts' },
  { id: 'power', label: 'Power & battery' },
  { id: 'keys', label: 'Keys & buttons' },
  { id: 'gps', label: 'GPS / APRS' },
  { id: 'dmr', label: 'DMR & calls' },
  { id: 'privacy', label: 'Privacy / lock' },
  { id: 'other', label: 'Other' },
] as const;

export type Dm32SettingsGroupId = (typeof DM32_SETTINGS_GROUPS)[number]['id'];

export type Dm32SettingConfidence = 'traced' | 'partially-traced' | 'unknown';

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
  confidence: Dm32SettingConfidence;
  /** Password bytes: shown masked until the viewer reveals them. */
  sensitive?: boolean;
  /** Where in `settings.md` the field is documented, with the 048 evidence. */
  source: string;
  help?: string;
}

const SRC = 'settings.md';

/** Bytes up to the first NUL, at most the span: not trimmed, not stopped at 0xFF. */
function asciiToNul(bytes: Uint8Array): string {
  let end = 0;
  while (end < bytes.length && bytes[end] !== 0x00) end++;
  return new TextDecoder('latin1').decode(bytes.subarray(0, end));
}

/** Printable ASCII up to the first NUL, else hex: for password bytes of unknown format. */
function asciiOrHex(bytes: Uint8Array): string {
  let end = 0;
  while (end < bytes.length && bytes[end] !== 0x00) end++;
  const text = bytes.subarray(0, end);
  return text.every((b) => b >= 0x20 && b <= 0x7e)
    ? new TextDecoder('latin1').decode(text)
    : Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');
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
const shiftOf = (mask: number) => 31 - Math.clz32(mask & -mask);
/** Enum over the masked bits of one byte; values past the list stay raw. */
const enumOf =
  (mask: number, labels: readonly string[]) =>
  (b: Uint8Array): string | undefined =>
    labels[(b[0]! & mask) >> shiftOf(mask)];
const table =
  (labels: readonly string[], from = 0) =>
  (b: Uint8Array) =>
    labels[b[0]! - from];

const COLOURS = ['White', 'Gray', 'Orange', 'Red', 'Yellow', 'Green', 'Cyan', 'Blue'] as const;
const LIGHT_TIME = [
  'Always On',
  '5 s',
  '10 s',
  '15 s',
  '20 s',
  '25 s',
  '30 s',
  '1 min',
  '2 min',
  '3 min',
  '4 min',
  '5 min',
] as const;
/** Weather channels: BCD table at 0x030AD814 in the firmware, MHz. */
const WEATHER_MHZ = [
  '162.550',
  '162.400',
  '162.475',
  '162.425',
  '162.450',
  '162.500',
  '162.525',
  '161.650',
  '161.775',
  '163.275',
] as const;
/** VOX gain levels 0..8 map to these thresholds (table at 0x030B5238). */
const VOX_THRESHOLDS = [114, 134, 152, 159, 162, 165, 168, 171, 174] as const;
/** Digital mic gain 0..7 map to these codec values (table at 0x030AB96C). */
const DIGI_MIC_CODEC = [7, 8, 9, 10, 11, 18, 19, 20] as const;

/** Auto power off: 0 Off; 1..4 are 30, 60, 120, 240 minutes; 5 and every other value 480. */
const autoPowerOff = (b: Uint8Array) => {
  const v = b[0]!;
  if (v === 0) return 'Off';
  const minutes = [30, 60, 120, 240][v - 1] ?? 480;
  return v > 5 ? `${minutes} minutes (value ${v} reads as 5)` : `${minutes} minutes`;
};

const timeZone = (b: Uint8Array) => {
  const v = b[0]!;
  if (v > 25) return undefined;
  const hours = Math.abs(v - 12)
    .toString()
    .padStart(2, '0');
  return v === 12 ? 'UTC' : `UTC${v > 12 ? '+' : '-'}${hours}:00`;
};

const weatherChannel = (b: Uint8Array) => {
  const v = b[0]!;
  const ok = v >= 1 && v <= 10;
  return `${WEATHER_MHZ[(ok ? v : 1) - 1]} MHz${ok ? '' : ` (value ${v} reads as 1)`}`;
};

interface Extra {
  mask?: number;
  decode?: (bytes: Uint8Array) => string | undefined;
  help?: string;
  sensitive?: boolean;
}

const GUESSED = 'Name guessed from the vendor CPS label order; no menu row writes it.';

const F = (
  id: string,
  group: Dm32SettingsGroupId,
  label: string,
  offset: number,
  length: number,
  confidence: Dm32SettingConfidence,
  evidence: string,
  extra: Extra = {},
): FieldSpec => ({
  id,
  group,
  label,
  offset,
  length,
  confidence,
  decode: extra.decode ?? (() => undefined),
  source: `${SRC}: ${evidence}`,
  ...(extra.mask === undefined ? {} : { mask: extra.mask }),
  ...(extra.help === undefined ? {} : { help: extra.help }),
  ...(extra.sensitive ? { sensitive: true } : {}),
});

const reportChannel = (n: number): FieldSpec =>
  F(
    `aprs-report-channel-${n}`,
    'gps',
    `APRS report channel ${n}`,
    0x320 + (n - 1) * 2,
    2,
    'traced',
    'APRS table, 0x320-0x32F; 0x03055DAC, 0x0305FE24, 0x03060C98',
    { decode: (b) => (u16le(b) === 0 ? '0 (current channel)' : String(u16le(b))) },
  );

const keyField = (
  id: string,
  label: string,
  offset: number,
  confidence: Dm32SettingConfidence = 'traced',
  help?: string,
): FieldSpec =>
  F(
    id,
    'keys',
    label,
    offset,
    1,
    confidence,
    `key-function codes, 0x${offset.toString(16).toUpperCase()}`,
    {
      decode: keyFunction,
      ...(help ? { help } : {}),
    },
  );

const colour = (
  id: string,
  label: string,
  offset: number,
  confidence: Dm32SettingConfidence,
  evidence: string,
  help?: string,
) => F(id, 'display', label, offset, 1, confidence, evidence, { decode: table(COLOURS), help });

/** The registry: every field the firmware 048 reads in `0x000`-`0x507`. */
export const DM32_SETTINGS_FIELDS: readonly FieldSpec[] = [
  // Display
  F(
    'power-on-interface',
    'display',
    'Start display (power-on screen)',
    0x00,
    1,
    'traced',
    '0x00; commit 0x0304E6B8, draw 0x0303F5B8, list 0x030B7B14',
    { decode: table(['Picture', 'Char String (the two lines below)', 'Voltage']) },
  ),
  F(
    'power-on-line-1',
    'display',
    'Power-on display line 1',
    0x01,
    14,
    'traced',
    '0x01; 0x0303F5B8 reads 16 bytes',
    {
      decode: asciiToNul,
      help: 'The firmware reads 16 bytes into a zeroed buffer, so a line with no NUL in 14 bytes runs into the next one.',
    },
  ),
  F(
    'power-on-line-2',
    'display',
    'Power-on display line 2',
    0x0f,
    14,
    'traced',
    '0x0F; 0x0303F5B8 reads 16 bytes',
    { decode: asciiToNul },
  ),
  F(
    'back-light',
    'display',
    'Back light (brightness)',
    0x30,
    1,
    'traced',
    '0x30; Display row 0, list 0x030B700C',
    {
      decode: (b) => (b[0]! <= 5 ? `Brightness ${b[0]! + 1}` : undefined),
    },
  ),
  F(
    'light-time',
    'display',
    'Light time (back light off delay)',
    0x31,
    1,
    'traced',
    '0x31; list 0x030B7910',
    {
      decode: table(LIGHT_TIME),
    },
  ),
  F(
    'menu-exit-time',
    'display',
    'Menu exit time',
    0x32,
    1,
    'partially-traced',
    '0x32; Display row 16',
    {
      decode: (b) => `${b[0]} (menu timer is 5 x value, and 10 above 60; unit inferred seconds)`,
      help: 'Arithmetic traced; the unit is inferred from the vendor CPS label "Menu Exit Time[s]".',
    },
  ),
  F(
    'time-display',
    'display',
    'Time display (clock on idle screen)',
    0x33,
    1,
    'traced',
    '0x33 bit 0; Time Set item 2 0x0304F7AC, list 0x030B8238',
    {
      mask: 0x01,
      decode: onOff,
    },
  ),
  F(
    'date-format',
    'display',
    'Date display format',
    0x33,
    1,
    'traced',
    '0x33 bit 3; Time Set item 3 0x0304F7AC, list 0x030B8260',
    {
      mask: 0x08,
      decode: enumOf(0x08, ['yyyy/mm/dd', 'dd/mm/yyyy']),
    },
  ),
  F(
    'volume-change-prompt',
    'display',
    'Volume change prompt (inferred name)',
    0x33,
    1,
    'partially-traced',
    '0x33 bit 4; loader (no menu writer)',
    {
      mask: 0x10,
      decode: onOff,
      help: 'Layout traced; name inferred: the CPS label before Time Display is "Volume Change Prompt".',
    },
  ),
  colour(
    'call-colour',
    'Call display colour (inferred enum)',
    0x34,
    'partially-traced',
    '0x34; Display row 4; colour list 0x030B6388',
    'Offset traced; the colour order is inferred (the picker 0x03042C68 was not read).',
  ),
  colour(
    'standby-colour',
    'Standby text colour (inferred enum)',
    0x35,
    'partially-traced',
    '0x35; Display row 5',
    'Offset traced; the colour order is inferred.',
  ),
  F(
    'tx-backlight-delay',
    'display',
    'TX back light delay (name guessed)',
    0x36,
    1,
    'unknown',
    '0x36; loader only, no reader by direct index',
    {
      help: GUESSED,
    },
  ),
  F(
    'rx-backlight-delay',
    'display',
    'RX back light delay (name guessed)',
    0x37,
    1,
    'unknown',
    '0x37; loader only, no reader by direct index',
    {
      help: GUESSED,
    },
  ),
  colour(
    'channel-name-colour-a',
    'Channel name colour A (inferred enum)',
    0x38,
    'partially-traced',
    '0x38; Display row 6',
    'Offset traced; the colour order is inferred.',
  ),
  colour(
    'channel-name-colour-b',
    'Channel name colour B (inferred enum)',
    0x39,
    'partially-traced',
    '0x39; Display row 7',
    'Offset traced; the colour order is inferred.',
  ),
  colour(
    'zone-colour-a',
    'Zone colour A (inferred enum)',
    0x3a,
    'partially-traced',
    '0x3A; Display row 8',
    'Offset traced; the colour order is inferred.',
  ),
  colour(
    'zone-colour-b',
    'Zone colour B (inferred enum)',
    0x3b,
    'partially-traced',
    '0x3B; Display row 9',
    'Offset traced; the colour order is inferred.',
  ),
  F(
    'channel-display-a',
    'display',
    'Channel display, side A',
    0x80,
    1,
    'traced',
    '0x80 bit 3; Display row 11, list 0x030B9454',
    {
      mask: 0x08,
      decode: enumOf(0x08, ['FREQ', 'CH Name']),
    },
  ),
  F(
    'channel-display-b',
    'display',
    'Channel display, side B',
    0x80,
    1,
    'traced',
    '0x80 bit 4; Display row 11',
    {
      mask: 0x10,
      decode: enumOf(0x10, ['FREQ', 'CH Name']),
    },
  ),
  F('led-indicator', 'display', 'LED indicator', 0xa4, 1, 'traced', '0xA4 bit 0; Display row 15', {
    mask: 0x01,
    decode: onOff,
  }),
  F('language', 'display', 'Language', 0xa4, 1, 'traced', '0xA4 bit 1; Display row 13, loader', {
    mask: 0x02,
    decode: enumOf(0x02, ['Chinese', 'English']),
    help: 'A factory-sector option byte +0xA0 of 0xA3 forces the English UI whatever this says.',
  }),

  // Tones
  F('radio-silent', 'tones', 'Radio silent', 0x20, 1, 'traced', '0x20 bit 7; Tone row 0', {
    mask: 0x80,
    decode: onOff,
  }),
  F('key-tone', 'tones', 'Key tone', 0x20, 1, 'traced', '0x20 bit 6; Tone row 2', {
    mask: 0x40,
    decode: onOff,
  }),
  F('sms-prompt', 'tones', 'SMS prompt', 0x20, 1, 'traced', '0x20 bit 5; Tone row 3', {
    mask: 0x20,
    decode: onOff,
  }),
  F('group-call-tone', 'tones', 'Group call tone', 0x20, 1, 'traced', '0x20 bit 4; Tone row 4', {
    mask: 0x10,
    decode: onOff,
  }),
  F(
    'private-call-tone',
    'tones',
    'Private call tone',
    0x20,
    1,
    'traced',
    '0x20 bit 3; Tone row 5',
    { mask: 0x08, decode: onOff },
  ),
  F('call-end-tone', 'tones', 'Call end tone', 0x20, 1, 'traced', '0x20 bit 2; Tone row 6', {
    mask: 0x04,
    decode: onOff,
  }),
  F('talk-permit-tone', 'tones', 'Talk permit tone', 0x20, 1, 'traced', '0x20 bit 1; Tone row 7', {
    mask: 0x02,
    decode: onOff,
  }),
  F('startup-sound', 'tones', 'Start-up sound', 0x20, 1, 'traced', '0x20 bit 0; Tone row 8', {
    mask: 0x01,
    decode: onOff,
  }),
  F('voice-prompt', 'tones', 'Voice prompt', 0x21, 1, 'traced', '0x21 bit 7; Tone row 9', {
    mask: 0x80,
    decode: onOff,
  }),
  F('battery-low-tone', 'tones', 'Battery low tone', 0x21, 1, 'traced', '0x21 bit 6; Tone row 1', {
    mask: 0x40,
    decode: onOff,
  }),
  F(
    'ana-roger',
    'tones',
    'Analogue roger (TX end tone)',
    0x21,
    1,
    'traced',
    '0x21 bits 5-4; Tone row 10, list 0x030B6184',
    {
      mask: 0x30,
      decode: enumOf(0x30, ['Off', 'Tone', '1200']),
    },
  ),

  // Power
  F(
    'auto-power-off',
    'power',
    'Auto power off',
    0x1e,
    1,
    'traced',
    '0x1E; id 0x5F, 0x0301B0C8, list 0x030B6418',
    {
      decode: autoPowerOff,
      help: 'Index 4 is 240 minutes and 5 is 480 minutes; every other non-zero value also means 480.',
    },
  ),
  F(
    'power-save',
    'power',
    'Power save',
    0xa4,
    1,
    'traced',
    '0xA4 bits 6-4; Other row 9, list 0x030B94B4',
    {
      mask: 0x70,
      decode: enumOf(0x70, ['Off', '1:1', '1:2', '1:4']),
    },
  ),

  // Keys
  keyField('side-key-1-short', 'Side key 1, short press', 0x87),
  keyField('side-key-1-long', 'Side key 1, long press', 0x88),
  keyField('side-key-2-short', 'Side key 2, short press', 0x89),
  keyField('side-key-2-long', 'Side key 2, long press', 0x8a),
  keyField(
    'tk-key-short',
    'TK key, short press',
    0x8b,
    'traced',
    'The radio has no physical TK key.',
  ),
  keyField(
    'tk-key-long',
    'TK key, long press',
    0x8c,
    'traced',
    'The radio has no physical TK key.',
  ),
  keyField('prog-key-1-short', 'Programmable key 1, short press', 0x8d),
  keyField('prog-key-1-long', 'Programmable key 1, long press', 0x8e),
  keyField('prog-key-2-short', 'Programmable key 2, short press', 0x8f),
  keyField('prog-key-2-long', 'Programmable key 2, long press', 0x90),
  keyField(
    'p3-key-short',
    'P3 key, short press (inferred name)',
    0x91,
    'partially-traced',
    'Loaded only; name inferred from the CPS "P3 Short" label.',
  ),
  keyField(
    'p3-key-long',
    'P3 key, long press (inferred name)',
    0x92,
    'partially-traced',
    'Loaded only; name inferred from the CPS "P3 Long" label.',
  ),
  F('long-press', 'keys', 'Long press time', 0x93, 1, 'traced', '0x93; id 0x51, Key row 11', {
    decode: (b) =>
      b[0]! >= 1 && b[0]! <= 10 ? `${b[0]} (key timer is 5 x value)` : `${b[0]} (reads as 1)`,
  }),

  // Privacy / lock
  F(
    'key-lock',
    'privacy',
    'Auto keypad lock (switch)',
    0x85,
    1,
    'traced',
    '0x85 bit 0; Keypad Lock > Switch 0x0304F7AC',
    {
      mask: 0x01,
      decode: onOff,
      help: 'Bit 0 only; bits 1-3 are other lock flags.',
    },
  ),
  F(
    'lock-flag-knob',
    'privacy',
    'Knob lock (name guessed)',
    0x85,
    1,
    'unknown',
    '0x85 bit 1; loader',
    { mask: 0x02, decode: onOff, help: GUESSED },
  ),
  F(
    'lock-flag-side-key',
    'privacy',
    'Side key lock (name guessed)',
    0x85,
    1,
    'unknown',
    '0x85 bit 2; loader',
    { mask: 0x04, decode: onOff, help: GUESSED },
  ),
  F(
    'lock-flag-forbid-lock-key',
    'privacy',
    'Forbid lock key (name guessed)',
    0x85,
    1,
    'unknown',
    '0x85 bit 3; loader',
    { mask: 0x08, decode: onOff, help: GUESSED },
  ),
  F(
    'auto-lock-delay',
    'privacy',
    'Auto keypad lock delay',
    0x86,
    1,
    'partially-traced',
    '0x86; id 0x2E, 0x0304F7AC',
    {
      decode: (b) => `${Math.min(b[0]!, 55) + 5} (5 to 60; unit inferred seconds)`,
      help: 'Arithmetic traced; the unit is inferred from the CPS label "Lock Time Delay:".',
    },
  ),
  F(
    'power-on-password-enable',
    'privacy',
    'Power-on password enable',
    0x430,
    1,
    'traced',
    '0x430; loader, 0x3E3B0+8 bit 0 gates key, PTT and screen code (0x030127DC, 0x0301302C)',
    {
      decode: (b) => (b[0] === 0xa5 ? 'On (0xA5)' : 'Off (not 0xA5)'),
      help: 'The loader skips it while PCTESTM is active.',
    },
  ),
  F(
    'power-on-password',
    'privacy',
    'Power-on password',
    0x431,
    8,
    'traced',
    '0x431-0x438; loader',
    {
      decode: asciiOrHex,
      sensitive: true,
      help: 'ASCII digits, up to 8. Hidden until revealed.',
    },
  ),
  F(
    'password-set-flags',
    'privacy',
    'Password-set flags',
    0x439,
    2,
    'traced',
    '0x439-0x43A; PASSSTA, 0x0302A324',
  ),
  F('write-password', 'privacy', 'Write password', 0x43b, 8, 'traced', '0x43B-0x442; 0x0302A208', {
    decode: asciiOrHex,
    sensitive: true,
    help: 'Hidden until revealed.',
  }),
  F('read-password', 'privacy', 'Read password', 0x443, 8, 'traced', '0x443-0x44A; 0x0302A208', {
    decode: asciiOrHex,
    sensitive: true,
    help: 'Hidden until revealed.',
  }),

  // GPS / APRS
  F('gps-enable', 'gps', 'GNSS on', 0x40, 1, 'traced', '0x40 bit 0; GNSS row 0 0x0304BF54', {
    mask: 0x01,
    decode: onOff,
    help: 'Ignored by the firmware unless factory option +0x80 bit 2 (GPS fitted) is set.',
  }),
  F(
    'gnss-b1',
    'gps',
    'GNSS flag, bit 1 (name guessed)',
    0x40,
    1,
    'unknown',
    '0x40 bit 1; loader (no menu writer)',
    {
      mask: 0x02,
      decode: onOff,
      help: 'Name guessed: the CPS lists Distance Unit and Speed Unit.',
    },
  ),
  F(
    'gnss-mode',
    'gps',
    'GNSS mode',
    0x40,
    1,
    'traced',
    '0x40 bits 3-2; GNSS row 4, list 0x030B5B74',
    {
      mask: 0x0c,
      decode: enumOf(0x0c, ['GPS', 'BDS', 'GPS + BDS']),
    },
  ),
  F(
    'gnss-b54',
    'gps',
    'GNSS flags, bits 5-4 (name guessed)',
    0x40,
    1,
    'unknown',
    '0x40 bits 5-4; loader (no menu writer)',
    {
      mask: 0x30,
      decode: (b) => String((b[0]! & 0x30) >> 4),
      help: 'Name guessed: the CPS lists Distance Unit and Speed Unit.',
    },
  ),
  F(
    'gnss-display-format',
    'gps',
    'GNSS display format',
    0x40,
    1,
    'traced',
    '0x40 bit 6; GNSS row 3, list 0x030B67A8',
    {
      mask: 0x40,
      decode: enumOf(0x40, ['DDD', 'DMS']),
    },
  ),
  F('time-zone', 'gps', 'Time zone', 0x41, 1, 'traced', '0x41; GNSS row 2, list 0x030B6710', {
    decode: timeZone,
    help: 'Index 0..25 is UTC-12:00 to UTC+13:00; 12 is UTC.',
  }),
  F(
    'gnss-measure-period',
    'gps',
    'Measure period interval (name guessed)',
    0x42,
    1,
    'unknown',
    '0x42; loader reads 0x40 length 3, no menu writer',
    {
      decode: u8,
      help: 'Name guessed from the CPS label "Measure Period Interval[s]".',
    },
  ),
  F(
    'aprs-scheduled-send',
    'gps',
    'APRS scheduled send time',
    0x301,
    1,
    'partially-traced',
    '0x301; id 0x59, 0x0305FC4C',
    {
      decode: (b) => `${b[0]} (sent every value x 30; unit inferred seconds)`,
      help: 'Arithmetic traced; the unit is inferred from the CPS label "Scheduled Send Time[s]".',
    },
  ),
  F(
    'aprs-fixed-beacon',
    'gps',
    'APRS upload beacon',
    0x302,
    1,
    'traced',
    '0x302 bit 0; APRS row 6 0x0304B890, list 0x030B858C',
    {
      mask: 0x01,
      decode: enumOf(0x01, ['GPS Beacon', 'Fixed Beacon']),
    },
  ),
  F('aprs-latitude', 'gps', 'APRS latitude (string)', 0x306, 9, 'traced', '0x306; 0x0305FC4C', {
    decode: asciiToNul,
  }),
  F('aprs-latitude-ns', 'gps', 'APRS latitude N/S', 0x30f, 1, 'traced', '0x30F; 0x0305FC4C', {
    decode: letter(['N', 'S']),
  }),
  F('aprs-longitude', 'gps', 'APRS longitude (string)', 0x310, 9, 'traced', '0x310; 0x0305FC4C', {
    decode: asciiToNul,
  }),
  F('aprs-longitude-ew', 'gps', 'APRS longitude E/W', 0x319, 1, 'traced', '0x319; 0x0305FC4C', {
    decode: letter(['E', 'W']),
  }),
  ...[1, 2, 3, 4, 5, 6, 7, 8].map(reportChannel),
  F(
    'aprs-call-type',
    'gps',
    'APRS upload type (call type)',
    0x331,
    1,
    'partially-traced',
    '0x331 bit 0; 0x0304B834, 0x0305FC4C',
    {
      mask: 0x01,
      decode: enumOf(0x01, ['Private call (polarity inferred)', 'Group call (polarity inferred)']),
      help: 'Bit traced; which value is the group call is inferred.',
    },
  ),
  F(
    'aprs-upload-id',
    'gps',
    'APRS upload DMR ID (24-bit little-endian)',
    0x332,
    3,
    'traced',
    '0x332-0x334; 0x0304B814, 0x0305FC4C',
    {
      decode: (b) => `${u24le(b)}${u24le(b) === 0 ? ' (reads as 1)' : ''}`,
    },
  ),

  // DMR & calls
  F(
    'pcall-match',
    'dmr',
    'PCall match',
    0x60,
    1,
    'traced',
    '0x60 bit 0; Other row 19, 0x03049904',
    { mask: 0x01, decode: onOff },
  ),
  F('gcall-match', 'dmr', 'GCall match', 0x60, 1, 'traced', '0x60 bit 1; Other row 20', {
    mask: 0x02,
    decode: onOff,
    help: 'MM9PDY talk group / RX group list mode builds on it.',
  }),
  F(
    'dmr-timing-a',
    'dmr',
    'DMR timing A (name guessed)',
    0x61,
    1,
    'unknown',
    '0x61; 0x03049904, 0x0301DC18',
    {
      decode: (b) => `${(b[0]! + 1) * 50} (value + 1, x 50)`,
      help: 'Arithmetic traced; name guessed: CPS "Active Wait Time[ms]" or "Pre-Carrier Time[ms]".',
    },
  ),
  F('dmr-timing-b', 'dmr', 'DMR timing B (name guessed)', 0x62, 1, 'unknown', '0x62; 0x0301DC54', {
    decode: (b) => `${300 + 30 * ((b[0] || 1) - 1)} (300 + 30 x (value - 1); 0 reads as 1)`,
    help: 'Arithmetic traced; name guessed: the other of CPS "Active Wait Time[ms]" and "Pre-Carrier Time[ms]".',
  }),
  F(
    'dmr-retries',
    'dmr',
    'DMR retries (inferred name)',
    0x63,
    1,
    'partially-traced',
    '0x63; 0x0301DC5C',
    {
      decode: (b) => `${Math.min(Math.max(b[0]!, 1), 8)} (1 to 8)`,
      help: 'Traced; name inferred from the CPS label "Active Retries Time".',
    },
  ),
  F(
    'dmr-hold-time',
    'dmr',
    'DMR call hold time (inferred name)',
    0x64,
    1,
    'partially-traced',
    '0x64; 0x0301DC64',
    {
      decode: (b) => `${b[0]! > 17 ? 2 : b[0]! + 2} (value + 2; above 17 reads as 2)`,
      help: 'Traced; name inferred from the CPS label "Call Hold Time[s]".',
    },
  ),
  F(
    'sms-format',
    'dmr',
    'SMS format',
    0x65,
    1,
    'traced',
    '0x65 bits 2-1; Other row 18, list 0x030B94F4, 0x0305BF08',
    {
      mask: 0x06,
      decode: enumOf(0x06, ['H-SMS', 'M-SMS', 'D-SMS', 'D-SMS (3 reads as 2)']),
    },
  ),
  F(
    'remote-flag-1',
    'dmr',
    'Remote command decode flag 1 (name guessed)',
    0x65,
    1,
    'unknown',
    '0x65 bit 3; 0x03020660(1)',
    { mask: 0x08, decode: onOff, help: 'Name guessed: Radio Disable.' },
  ),
  F(
    'remote-flag-2',
    'dmr',
    'Remote command decode flag 2 (name guessed)',
    0x65,
    1,
    'unknown',
    '0x65 bit 7; 0x03020660(2)',
    { mask: 0x80, decode: onOff, help: 'Name guessed: Remote Monitor.' },
  ),
  F(
    'remote-flag-3',
    'dmr',
    'Remote command decode flag 3 (name guessed)',
    0x65,
    1,
    'unknown',
    '0x65 bit 6; 0x03020660(3)',
    { mask: 0x40, decode: onOff, help: 'Name guessed: Call Alert.' },
  ),
  F(
    'remote-flag-4',
    'dmr',
    'Remote command decode flag 4 (name guessed)',
    0x65,
    1,
    'unknown',
    '0x65 bit 5; 0x03020660(4)',
    { mask: 0x20, decode: onOff, help: 'Name guessed: Radio Enable.' },
  ),
  F(
    'remote-flag-5',
    'dmr',
    'Remote command decode flag 5 (name guessed)',
    0x65,
    1,
    'unknown',
    '0x65 bit 4; 0x03020660(5)',
    { mask: 0x10, decode: onOff, help: 'Name guessed: Radio Check Decode.' },
  ),
  F(
    'missed-call-alert',
    'dmr',
    'Flag (name guessed: missed call alert)',
    0x65,
    1,
    'unknown',
    '0x65 bit 0; read in 0x0302B4C4',
    { mask: 0x01, decode: onOff, help: GUESSED },
  ),
  F(
    'remote-monitor-time',
    'dmr',
    'Remote monitor time (inferred name)',
    0x66,
    1,
    'partially-traced',
    '0x66; 0x0305BF08',
    {
      decode: (b) =>
        `${b[0]! >= 12 ? 10 : (b[0]! + 1) * 10} ((value + 1) x 10; 12 or more reads as 10)`,
      help: 'Arithmetic traced; name inferred from the CPS label "Remote Monitor Time[s]".',
    },
  ),
  F(
    'send-talker-alias',
    'dmr',
    'Send talker alias (inferred name)',
    0x67,
    1,
    'partially-traced',
    '0x67 bit 3; loader, 0x0305F2D4, 0x0305F290',
    {
      mask: 0x08,
      decode: onOff,
      help: 'Name inferred from the menu "Tx With Alias". Cleared at run time if the alias is empty. The alias sent is the radio-ID name, not the text at 0x50.',
    },
  ),
  F(
    'alias-priority',
    'dmr',
    'Alias display priority (inferred name)',
    0x67,
    1,
    'partially-traced',
    '0x67 bit 2; 0x0302A96C',
    {
      mask: 0x04,
      decode: onOff,
      help: 'Name inferred from the menu "Contact First / Alias First".',
    },
  ),
  F(
    'alias-data-format',
    'dmr',
    'Alias data format (inferred name)',
    0x67,
    1,
    'partially-traced',
    '0x67 bits 7-6',
    {
      mask: 0xc0,
      decode: (b) => String((b[0]! & 0xc0) >> 6),
      help: 'Name inferred from the menu "ISO 8bit / Unicode".',
    },
  ),

  // Other
  F('allow-reset', 'other', 'Allow reset', 0x1d, 1, 'traced', '0x1D bit 0; loader, F27', {
    mask: 0x01,
    decode: onOff,
  }),
  F(
    'talker-alias-text',
    'other',
    'Talker-alias text (written, never read)',
    0x50,
    16,
    'traced',
    '0x50; writer 0x0304C650 case 8 -> 0x0305F2C0',
    {
      decode: asciiToNul,
      help: 'Typed in Contacts > Talker Alias and never read back by 048; the extent (16) is not traced. The alias the radio sends is the radio-ID name.',
    },
  ),
  F(
    'only-channel-mode',
    'other',
    'Only channel mode (inferred name)',
    0x80,
    1,
    'partially-traced',
    '0x80 bit 0; loader',
    {
      mask: 0x01,
      decode: onOff,
      help: 'Effect traced (forces both sides to channel mode with name display); name inferred from the CPS label.',
    },
  ),
  F(
    'work-mode-a',
    'other',
    'Work mode, side A (inferred polarity)',
    0x80,
    1,
    'partially-traced',
    '0x80 bit 1; key function 7 0x03015D32',
    {
      mask: 0x02,
      decode: enumOf(0x02, ['VFO', 'MR']),
      help: 'Bit traced; VFO / MR polarity inferred.',
    },
  ),
  F(
    'work-mode-b',
    'other',
    'Work mode, side B (inferred polarity)',
    0x80,
    1,
    'partially-traced',
    '0x80 bit 2',
    {
      mask: 0x04,
      decode: enumOf(0x04, ['VFO', 'MR']),
      help: 'Bit traced; VFO / MR polarity inferred.',
    },
  ),
  F('main-channel', 'other', 'Main channel', 0x80, 1, 'traced', '0x80 bit 5; 0x03038AB8', {
    mask: 0x20,
    decode: enumOf(0x20, ['A', 'B']),
  }),
  F(
    'dual-watch',
    'other',
    'Dual watch',
    0x80,
    1,
    'traced',
    '0x80 bits 7-6; Display row 12, list 0x030B63C4',
    {
      mask: 0xc0,
      decode: enumOf(0xc0, ['Single Mode', 'Double Wait', 'Single Wait']),
    },
  ),
  F(
    'dual-watch-hang',
    'other',
    'Dual watch hang time (inferred name)',
    0x81,
    1,
    'partially-traced',
    '0x81; loader, 0x0300E270, 0x0305A4B0',
    {
      decode: (b) =>
        `${Math.min(Math.max(b[0]!, 1), 13) * 10} (clamped 1 to 13, x 10; unit inferred ms)`,
      help: 'Arithmetic traced; name and unit inferred from the CPS label "Dual Watch Hang Time[ms]".',
    },
  ),
  F('tot', 'other', 'TX timer (TOT)', 0xa0, 1, 'traced', '0xA0; Other row 1', {
    decode: (b) => (b[0]! > 97 ? `${b[0]} (reads as 22)` : String(b[0])),
    help: 'Range 0 to 97; the unit is not traced.',
  }),
  F('tot-predict', 'other', 'TOT predict (pre-alert)', 0xa1, 1, 'traced', '0xA1; Other row 2', {
    decode: u8,
  }),
  F(
    'vox-gain',
    'other',
    'VOX gain level',
    0xa2,
    1,
    'traced',
    '0xA2; id 0x3A, 0x030B5238, 0x0305FABC',
    {
      decode: (b) => (b[0]! <= 8 ? `${b[0]} (threshold ${VOX_THRESHOLDS[b[0]!]})` : undefined),
    },
  ),
  F('vox-delay', 'other', 'VOX delay', 0xa3, 1, 'traced', '0xA3; Other row 4', { decode: u8 }),
  F('weather-alarm', 'other', 'Weather alarm', 0xa4, 1, 'traced', '0xA4 bit 2; Other row 14', {
    mask: 0x04,
    decode: onOff,
  }),
  F(
    'tail',
    'other',
    'Squelch tail elimination',
    0xa5,
    1,
    'traced',
    '0xA5 bits 1-0; Other row 16, list 0x030B64D8',
    {
      mask: 0x03,
      decode: enumOf(0x03, ['Off', '120 deg', '180 deg', '55 Hz']),
    },
  ),
  F(
    'tbst',
    'other',
    'TBST selection',
    0xa5,
    1,
    'traced',
    '0xA5 bits 5-4; Other row 15, list 0x030B64B0',
    {
      mask: 0x30,
      decode: enumOf(0x30, ['1000 Hz', '1450 Hz', '1750 Hz', '2100 Hz']),
    },
  ),
  F(
    'ana-mic-gain',
    'other',
    'Analogue mic gain',
    0xa6,
    1,
    'traced',
    '0xA6; Other row 6, boot 0x0300D518',
    {
      decode: (b) => (b[0]! <= 4 ? `Level ${b[0]! + 1}` : `${b[0]} (reads as Level 3 at boot)`),
    },
  ),
  F(
    'digi-mic-gain',
    'other',
    'Digital mic gain',
    0xa7,
    1,
    'traced',
    '0xA7; Other row 7, 0x030AB96C, 0x0301D970',
    {
      decode: (b) => (b[0]! <= 7 ? `${b[0]} (codec value ${DIGI_MIC_CODEC[b[0]!]})` : undefined),
    },
  ),
  F(
    'weather-channel-a',
    'other',
    'Weather channel, side A',
    0xa8,
    1,
    'partially-traced',
    '0xA8; 0x030AD814, 0x0302F950',
    {
      decode: weatherChannel,
      help: 'Frequency table traced; "weather" is inferred from the frequencies and the Weather Alarm row.',
    },
  ),
  F(
    'weather-channel-b',
    'other',
    'Weather channel, side B',
    0xa9,
    1,
    'partially-traced',
    '0xA9; 0x030AD814',
    {
      decode: weatherChannel,
      help: 'Frequency table traced; "weather" is inferred from the frequencies and the Weather Alarm row.',
    },
  ),
  F(
    'mm9pdy-light-mode',
    'other',
    'MM9PDY: light mode',
    0xb0,
    1,
    'traced',
    '0xB0; MM9PDY firmware lightmode.c, F225',
    {
      decode: (b) => (b[0] === 0x01 ? 'Light' : 'Dark'),
      help: 'Used only by MM9PDY firmware; stock does not read it.',
    },
  ),
  F(
    'mm9pdy-rx-match',
    'other',
    'MM9PDY: RX match',
    0xb1,
    1,
    'traced',
    '0xB1; MM9PDY firmware zrxts.c',
    {
      decode: (b) => (b[0] === 0x01 ? 'Talk group' : 'Not talk group'),
      help: 'Used only by MM9PDY firmware; stock does not read it.',
    },
  ),
];

export type Dm32UnusedKind = 'free' | 'unread' | 'mm9pdy-reserved';

export interface Dm32UnusedRange {
  id: string;
  kind: Dm32UnusedKind;
  label: string;
  offset: number;
  length: number;
  source: string;
}

const UNUSED_LABEL: Record<Dm32UnusedKind, string> = {
  free: 'Free: never read or written by 048 (ledger F222)',
  unread: 'Unused: no reader in 048 (the vendor CPS may still write it)',
  'mm9pdy-reserved': 'Reserved for MM9PDY settings (0xB0-0xBF)',
};

const unused = (
  kind: Dm32UnusedKind,
  offset: number,
  length: number,
  note?: string,
): Dm32UnusedRange => ({
  id: `${kind}-${offset.toString(16).padStart(3, '0')}`,
  kind,
  label: note ? `${UNUSED_LABEL[kind]}; ${note}` : UNUSED_LABEL[kind],
  offset,
  length,
  source: `${SRC}: ${kind === 'free' ? 'free ranges, F222' : kind === 'unread' ? 'census of 048 reads' : 'codeplug-records 2.6'}`,
});

/** Bytes in `0x000`-`0x507` that no field or range reads: free, not read by 048, or MM9PDY. */
export const DM32_SETTINGS_UNUSED: readonly Dm32UnusedRange[] = [
  unused('free', 0x01f, 1),
  unused('free', 0x022, 14),
  unused('free', 0x03c, 4),
  unused('unread', 0x043, 13, 'the CPS touches 0x45'),
  unused('free', 0x068, 24),
  unused('unread', 0x082, 3, 'the CPS touches 0x60-0x93'),
  unused('unread', 0x094, 3),
  unused('free', 0x097, 9),
  unused('free', 0x0aa, 6),
  unused('mm9pdy-reserved', 0x0b2, 14),
  unused('free', 0x0c0, 94),
  unused('free', 0x160, 160),
  unused('unread', 0x219, 23),
  unused('unread', 0x284, 125),
  unused('unread', 0x303, 3),
  unused('unread', 0x31a, 6),
  unused('unread', 0x330, 1, 'the CPS label is "Repeater Active Delay[ms]"'),
  unused('free', 0x335, 251),
  unused('free', 0x44b, 181),
];

export interface Dm32DocumentedRange {
  id: string;
  label: string;
  offset: number;
  length: number;
  confidence: Dm32SettingConfidence;
  source: string;
}

const range = (
  id: string,
  label: string,
  offset: number,
  length: number,
  line: string,
): Dm32DocumentedRange => ({
  id,
  label,
  offset,
  length,
  confidence: 'partially-traced',
  source: `${SRC}: ${line}`,
});

/** Areas whose reads are traced but whose record contents are not decoded: shown raw. */
export const DM32_SETTINGS_DOCUMENTED_RANGES: readonly Dm32DocumentedRange[] = [
  range(
    'one-key-call',
    'Analog one-key call entries (2 bytes each: type 1 to 4, then index; count not established)',
    0x11e,
    0x42,
    'one-key call, 0x11E + 2n; 0x03062D14',
  ),
  range(
    'one-touch-call',
    'One-touch call, Hot Key 1 to 5 (5 x 5 bytes)',
    0x200,
    25,
    'one-touch call; 0x03062CE4',
  ),
  range(
    'fun-plus',
    'Fun+ entries (12 x 7 bytes: digit keys 0 to 9, then 10 and 11)',
    0x230,
    84,
    'Fun+; 0x03062F10',
  ),
  range(
    'menu-flags',
    'Menu-row enable bits (bit-to-row map not done)',
    0x500,
    8,
    'menu-row enable bits; 0x03047E8C',
  ),
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
  confidence: Dm32SettingConfidence;
  /** Password bytes: the viewer masks value and raw bytes until revealed. */
  sensitive: boolean;
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
  confidence: Dm32SettingConfidence;
  source: string;
  status: 'captured' | 'not-captured';
  raw?: number[];
}

export interface Dm32UnusedRangeView {
  id: string;
  kind: Dm32UnusedKind;
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
  traced: number;
  partiallyTraced: number;
  unknownConfidence: number;
  documentedRanges: number;
  documentedRangesCaptured: number;
  unusedRanges: number;
  /** Bytes in unused ranges (free, not read by 048, MM9PDY reserved), captured or not. */
  unusedBytes: number;
  /** Captured bytes in the layout covered by no field, documented range or unused range. */
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
      unused: Dm32UnusedRangeView[];
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
      confidence: spec.confidence,
      sensitive: spec.sensitive === true,
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

  const unusedViews: Dm32UnusedRangeView[] = DM32_SETTINGS_UNUSED.map((r) => {
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
    unused: unusedViews,
    unknown,
    counts: {
      registered: fields.length,
      captured: fields.filter((x) => x.status === 'captured').length,
      decoded: fields.filter((x) => x.value !== undefined).length,
      traced: fields.filter((x) => x.confidence === 'traced').length,
      partiallyTraced: fields.filter((x) => x.confidence === 'partially-traced').length,
      unknownConfidence: fields.filter((x) => x.confidence === 'unknown').length,
      documentedRanges: documented.length,
      documentedRangesCaptured: documented.filter((x) => x.status === 'captured').length,
      unusedRanges: unusedViews.length,
      unusedBytes: DM32_SETTINGS_UNUSED.reduce((n, r) => n + r.length, 0),
      unknownBytes,
    },
  };
}
