/**
 * The UV-5R Mini settings frame (`0x9000–0x903F`, 64 bytes) and VFO frame (`0x8000–0x803F`, 2 × 32 bytes, A then B)
 * of a full read, as read-only views for the debug page. No I/O, no write path: this module names bytes and formats
 * them, nothing more.
 *
 * Source: the radio repo's static trace of v0.04 `app.bin` (PR #219, ledger F302-F309); v0.27 runs the same code
 * relocated. Settings: 45 bytes named, 19 with no reader. VFO: 22 bytes traced, 2 inferred, 8 unread. Confidence:
 * `traced` (code address and meaning), `partly` (traced use, inferred meaning or name, marked "inferred"). A byte no
 * code reads is **unused (no reader)**, never unknown. "No reader" means no reference in either build's refs,
 * decompile or immediates; a computed pointer access is not ruled out.
 *
 * Storage: the log slot is 0x60 bytes: the 64 bytes, 30 zero bytes and a CRC-16/XMODEM at `0x5E` (LE); a bad CRC
 * loads the defaults. The viewer does not check the CRC.
 */

import type { Uv5rMiniConfidence } from './calibrationLayout.ts';
import { UV5R_MINI_FULL_READ_SIZE } from './fullRead.ts';

export const UV5R_MINI_SETTINGS_START = 0x9000;
export const UV5R_MINI_SETTINGS_SIZE = 64;
export const UV5R_MINI_VFO_START = 0x8000;
export const UV5R_MINI_VFO_RECORD_SIZE = 32;

/** `named`: the firmware reads the byte for the meaning given; `no-reader`: nothing reads it. */
export type Uv5rMiniFrameFieldKind = 'named' | 'no-reader';

export interface Uv5rMiniFrameField {
  /** Offset inside the frame (inside the record, for the VFO frame). */
  offset: number;
  length: number;
  name: string;
  /** Encoding as the radio stores it. */
  encoding: string;
  /** The value as the firmware default has it, as text; empty where not stated. */
  defaultText: string;
  kind: Uv5rMiniFrameFieldKind;
  confidence: Uv5rMiniConfidence;
  /** Function address, or the reason for the confidence. */
  evidence: string;
  /** Value as text from the frame's bytes at `offset` (`length` of them). */
  format: (bytes: Uint8Array) => string;
}

const hex = (n: number) => `0x${n.toString(16).toUpperCase().padStart(2, '0')}`;
const unlisted = (n: number) => `${hex(n)} (not in the firmware's table)`;

const onOff = (b: Uint8Array) => (b[0] === 0 ? 'Off' : b[0] === 1 ? 'On' : unlisted(b[0]));
const pick = (labels: Record<number, string>) => (b: Uint8Array) => labels[b[0]] ?? unlisted(b[0]);
const raw = (b: Uint8Array) => hex(b[0]);
const none = () => 'No reader';

type Row = [
  offset: number,
  length: number,
  name: string,
  encoding: string,
  defaultText: string,
  evidence: string,
  format: (b: Uint8Array) => string,
  confidence?: Uv5rMiniConfidence,
];

const toField = (row: Row): Uv5rMiniFrameField => ({
  offset: row[0],
  length: row[1],
  name: row[2],
  encoding: row[3],
  defaultText: row[4],
  kind: 'named',
  confidence: row[7] ?? 'traced',
  evidence: row[5],
  format: row[6],
});

const noReader = (
  offset: number,
  length: number,
  defaultText: string,
  confidence: Uv5rMiniConfidence = 'traced',
  evidence = 'No reader in either build',
): Uv5rMiniFrameField => ({
  offset,
  length,
  name: 'Unused (no reader)',
  encoding: '',
  defaultText,
  kind: 'no-reader',
  confidence,
  evidence,
  format: none,
});

const u16le = (b: Uint8Array) => `${b[0] | (b[1] << 8)} MHz`;

const SETTINGS_NAMED: readonly Row[] = [
  [
    0x00,
    1,
    'Squelch',
    '0 OFF, 1-9',
    '3',
    '0x1E444B0, 0x1E4F3CA',
    (b) => (b[0] === 0 ? 'OFF' : String(b[0])),
  ],
  [0x01, 1, 'Power Save', '0/1', '1', '0x1E43E92', onOff],
  [
    0x02,
    1,
    'VOX level',
    '0-8 = 1-9',
    '4',
    '0x1E43DBE',
    (b) => (b[0] <= 8 ? String(b[0] + 1) : unlisted(b[0])),
  ],
  [
    0x03,
    1,
    'Backlight',
    '0 always on, 1-4 = 5/10/15/20 s',
    '3',
    '0x1E44120',
    (b) => (b[0] === 0 ? 'Always on' : b[0] <= 4 ? `${b[0] * 5} s` : unlisted(b[0])),
  ],
  [0x04, 1, 'Dual Watch', '0/1', '1', '0x1E43F12', onOff],
  [
    0x05,
    1,
    'TOT',
    '0 OFF, n × 15 s (1-12)',
    '8',
    '0x1E4492A; timer n × 150 × 100 ms',
    (b) => (b[0] === 0 ? 'OFF' : b[0] <= 12 ? `${b[0] * 15} s` : unlisted(b[0])),
  ],
  [0x06, 1, 'Beep', '0/1', '1', '0x1E44168', onOff],
  [0x07, 1, 'Voice prompts', '0/1', '1', '0x1E441E8', onOff],
  [
    0x08,
    1,
    'Language',
    '0 English, 1 Chinese',
    '0',
    '0x1E455C6',
    pick({ 0: 'English', 1: 'Chinese' }),
  ],
  [
    0x09,
    1,
    'DTMF sidetone',
    '0 OFF, 1 DT, 2 ANI, 3 DT+ANI',
    '0',
    '0x1E4574E',
    pick({ 0: 'OFF', 1: 'DT', 2: 'ANI', 3: 'DT+ANI' }),
  ],
  [
    0x0a,
    1,
    'Scan mode',
    '0 Time, 1 Carrier, 2 Search',
    '1',
    '0x1E44042',
    pick({ 0: 'Time', 1: 'Carrier', 2: 'Search' }),
  ],
  [
    0x0b,
    1,
    'PTT-ID',
    '0 OFF, 1 BOT, 2 EOT, 3 BOTH',
    '0',
    '0x1E45AD4',
    pick({ 0: 'OFF', 1: 'BOT', 2: 'EOT', 3: 'BOTH' }),
  ],
  [
    0x0c,
    1,
    'PTT-ID delay',
    '(n + 1) × 100 ms, 0-29',
    '5',
    '0x1E45B86',
    (b) => (b[0] <= 29 ? `${(b[0] + 1) * 100} ms` : unlisted(b[0])),
  ],
  [
    0x0d,
    1,
    'Display mode A',
    '0 name, 1 frequency, 2 channel',
    '1',
    '0x1E456C6',
    pick({ 0: 'Name', 1: 'Frequency', 2: 'Channel' }),
  ],
  [
    0x0e,
    1,
    'Display mode B',
    '0 name, 1 frequency, 2 channel',
    '1',
    '0x1E456C6; radio repo F265',
    pick({ 0: 'Name', 1: 'Frequency', 2: 'Channel' }),
  ],
  [0x0f, 1, 'Busy lockout (VFO mode)', '0/1', '0', '0x1E446BC', onOff],
  [0x10, 1, 'Auto keypad lock', '0/1', '0', '0x1E443A6', onOff],
  [
    0x11,
    1,
    'Alarm mode',
    '0 on site, 1 send sound, 2 send code',
    '0',
    '0x1E43F8A',
    pick({ 0: 'On site', 1: 'Send sound', 2: 'Send code' }),
  ],
  [0x12, 1, 'Alarm tone', '0/1', '1', '0x1E43FCA', onOff],
  [0x14, 1, 'Squelch-tail elimination', '0/1', '1', '0x1E43ED2, 0x1E4DEC8', onOff],
  [
    0x15,
    1,
    'Repeater tail clear',
    'n × 100 ms hold after TX',
    '5',
    '0x1E4F3CA, countdown 0x1A3B3 (100 ms tick 0x1E55232); unit traced, name inferred',
    (b) => `${b[0] * 100} ms`,
    'partly',
  ],
  [
    0x16,
    1,
    'Repeater tail detect',
    '(n + 2) × 100 ms hold after RX; 0 none',
    '5',
    '0x1E41984; unit traced, name inferred',
    (b) => (b[0] === 0 ? 'None' : `${(b[0] + 2) * 100} ms`),
    'partly',
  ],
  [0x17, 1, 'Roger beep', '0/1', '0', '0x1E441A8', onOff],
  [
    0x18,
    1,
    'Active side',
    '0 A, 1 B',
    '1',
    'Boot 0x1E4701C, A/B key 0x1E4D676',
    pick({ 0: 'A', 1: 'B' }),
  ],
  [
    0x19,
    1,
    'FM radio disable',
    '0 allowed, otherwise FM mode refused',
    '0',
    '0x1E52E02',
    (b) => (b[0] === 0 ? 'Allowed' : 'Refused'),
  ],
  [
    0x1a,
    1,
    'Work mode',
    'Low nibble A, high nibble B: 1 channel, 0 VFO',
    '0x11',
    '0x1E46E76',
    (b) => `A ${b[0] & 15 ? 'channel' : 'VFO'}, B ${b[0] >> 4 ? 'channel' : 'VFO'}`,
  ],
  [0x1b, 1, 'Keypad lock', '0/1', '0', '0x1E5147E', onOff],
  [
    0x1c,
    1,
    'Power-on screen',
    'Bits 1:0: 0 picture, 1 voltage',
    '0',
    '0x1E45646',
    (b) => ((b[0] & 3) === 0 ? 'Picture' : (b[0] & 3) === 1 ? 'Voltage' : unlisted(b[0])),
  ],
  [
    0x1d,
    1,
    'Tone burst',
    '0 1000, 1 1450, 2 1750, 3 2100 Hz',
    '2',
    '0x1E457B8',
    pick({ 0: '1000 Hz', 1: '1450 Hz', 2: '1750 Hz', 3: '2100 Hz' }),
  ],
  [
    0x20,
    1,
    'VOX delay',
    '0.5 + 0.1 n s, 0-15',
    '6',
    '0x1E44436',
    (b) => (b[0] <= 15 ? `${(0.5 + 0.1 * b[0]).toFixed(1)} s` : unlisted(b[0])),
  ],
  [
    0x21,
    1,
    'Menu exit time',
    'n < 10: (n + 1) × 5 s; 10: 60 s',
    '0',
    '0x1E4F266',
    (b) => (b[0] < 10 ? `${(b[0] + 1) * 5} s` : b[0] === 10 ? '60 s' : unlisted(b[0])),
  ],
  [
    0x22,
    1,
    'Wireless CPS (Bluetooth)',
    '0/1; 0xFF is reset to 0 at boot',
    '0',
    '0x1E44350, 0x1E4701C',
    (b) => (b[0] === 0xff ? '0xFF (reset to Off at boot)' : onOff(b)),
  ],
  [
    0x28,
    1,
    'TX time-out alert',
    '0 OFF, n s (1-10)',
    '0',
    '0x1E449DA',
    (b) => (b[0] === 0 ? 'OFF' : b[0] <= 10 ? `${b[0]} s` : unlisted(b[0])),
  ],
  [
    0x2b,
    1,
    'Tone-scan store',
    '0 all, 1 decoder, 2 encoder',
    '0',
    '0x1E45D2C',
    pick({ 0: 'All', 1: 'Decoder', 2: 'Encoder' }),
  ],
  [
    0x2c,
    2,
    'VFO scan range, low',
    'u16 LE MHz; clamped to band edges at boot',
    '400',
    '0x1E45C60',
    u16le,
  ],
  [
    0x2e,
    2,
    'VFO scan range, high',
    'u16 LE MHz; clamped to band edges at boot',
    '470',
    '0x1E45C60',
    u16le,
  ],
  [
    0x32,
    1,
    'SK1 short-press function',
    'Key code 07 FM, 1C scan, 1D sweep, 2D VOX, 08 lamp, 03 SOS; FF acts as 07',
    '07',
    '0x1E457E8',
    (b) =>
      ({
        0x07: 'FM',
        0x1c: 'Scan',
        0x1d: 'Sweep',
        0x2d: 'VOX',
        0x08: 'Lamp',
        0x03: 'SOS',
        0xff: 'FF (acts as FM)',
      })[b[0]] ?? `${hex(b[0])} (code not in the list)`,
  ],
  [
    0x33,
    1,
    'Second key function',
    'Key code; FF acts as 1C (scan); code 05 not traced. CHIRP writes the second programmable key at 0x34 (unknown7 here), but the firmware reads 0x33 (inferred statically)',
    '05',
    'Key 0x51',
    raw,
  ],
  [
    0x36,
    1,
    'NOAA channel',
    '0-9 into the weather-channel table 0x1E66010',
    '0',
    '0x1E4ED5A',
    (b) => (b[0] <= 9 ? `Channel ${b[0] + 1}` : unlisted(b[0])),
  ],
  [
    0x37,
    1,
    'Reset menu visible',
    'Bit 0',
    '1',
    '0x1E4606E',
    (b) => ((b[0] & 1) === 1 ? 'Visible' : 'Hidden'),
  ],
  [
    0x38,
    1,
    'Single display',
    'Non-zero with Dual Watch off: one enlarged side box; layout traced, name inferred',
    '0',
    '0x1E41166, 0x1E4E182',
    (b) => (b[0] === 0 ? 'Off' : 'On'),
    'partly',
  ],
  [
    0x39,
    1,
    'DTMF call hang time',
    'min(n, 7) + 3 s after a received DTMF sequence matches the ANI; unit traced, name inferred',
    '1',
    '0x1E41942, 0x1E53218',
    (b) => `${Math.min(b[0], 7) + 3} s`,
    'partly',
  ],
  [0x3a, 1, 'VOX switch', '0/1', '0', '0x1E43E52', onOff],
];

/**
 * The settings frame in offset order: 45 bytes named, 19 with no reader, no gaps. Offsets `0x34-0x35` default to
 * `1D 1C`, which look like ignored long-press slots (inferred).
 */
export const UV5R_MINI_SETTINGS_FIELDS: readonly Uv5rMiniFrameField[] = [
  ...SETTINGS_NAMED.map(toField),
  noReader(0x13, 1, '0'),
  noReader(0x1e, 2, '0'),
  noReader(0x23, 5, '0'),
  noReader(0x29, 2, '3, 0'),
  noReader(0x30, 2, '0'),
  noReader(
    0x34,
    2,
    '1D 1C',
    'partly',
    'No reader (static); defaults look like ignored long-press slots (inferred). CHIRP names 0x34 the second key, which the firmware does not read',
  ),
  noReader(0x3b, 5, '14, 0 …'),
].sort((a, b) => a.offset - b.offset);

export interface Uv5rMiniFrameFieldValue {
  field: Uv5rMiniFrameField;
  address: number;
  bytes: Uint8Array;
  /** The decoded value as text; "No reader" for an unused byte. */
  text: string;
}

export interface Uv5rMiniSettings {
  /** All 64 bytes read `0xFF` or `0x00`: the frame holds no settings. */
  empty: boolean;
  fields: Uv5rMiniFrameFieldValue[];
  counts: Uv5rMiniFrameCounts;
}

export interface Uv5rMiniFrameCounts {
  /** Bytes by confidence in named fields. */
  traced: number;
  partly: number;
  unknown: number;
  /** Named bytes in all. */
  named: number;
  /** Bytes with no reader. */
  noReader: number;
}

export function uv5rMiniFrameCounts(fields: readonly Uv5rMiniFrameField[]): Uv5rMiniFrameCounts {
  const counts = { traced: 0, partly: 0, unknown: 0, named: 0, noReader: 0 };
  const seen = new Set<number>();
  for (const f of fields) {
    // Rows that share a byte (masks) count that byte once, under the first row.
    const fresh = Array.from({ length: f.length }, (_, i) => f.offset + i).filter(
      (o) => !seen.has(o),
    );
    fresh.forEach((o) => seen.add(o));
    if (f.kind === 'no-reader') counts.noReader += fresh.length;
    else {
      counts.named += fresh.length;
      counts[f.confidence] += fresh.length;
    }
  }
  return counts;
}

function checkSize(decoded: Uint8Array, what: string): void {
  if (decoded.length < UV5R_MINI_FULL_READ_SIZE) {
    throw new Error(
      `A full read is ${UV5R_MINI_FULL_READ_SIZE} bytes; got ${decoded.length}, so it has no ${what}`,
    );
  }
}

/** Decode the settings frame of a decoded 64 KiB full read. Read only: returns copies. */
export function decodeUv5rMiniSettings(decoded: Uint8Array): Uv5rMiniSettings {
  checkSize(decoded, 'settings frame');
  const frame = decoded.subarray(
    UV5R_MINI_SETTINGS_START,
    UV5R_MINI_SETTINGS_START + UV5R_MINI_SETTINGS_SIZE,
  );
  return {
    empty: frame.every((b) => b === 0xff) || frame.every((b) => b === 0),
    fields: UV5R_MINI_SETTINGS_FIELDS.map((field) => {
      const bytes = frame.slice(field.offset, field.offset + field.length);
      return {
        field,
        address: UV5R_MINI_SETTINGS_START + field.offset,
        bytes,
        text: field.format(bytes),
      };
    }),
    counts: uv5rMiniFrameCounts(UV5R_MINI_SETTINGS_FIELDS),
  };
}

// ---------------------------------------------------------------------------
// VFO frame
// ---------------------------------------------------------------------------

/** Eight digit bytes (one digit each) as `MMM.MMMMM`, or the raw bytes if one is not a digit. */
function digitsText(bytes: Uint8Array, intDigits: number, unit: string): string {
  if (bytes.some((d) => d > 9))
    return `${Array.from(bytes, (b) => b.toString(16)).join(' ')} (not digits)`;
  const s = Array.from(bytes, String).join('');
  return `${s.slice(0, intDigits)}.${s.slice(intDigits)} ${unit}`;
}

const bits = (mask: number, shift: number) => (b: Uint8Array) => (b[0] & mask) >> shift;
const toneText = (b: Uint8Array) =>
  `0x${(b[0] | (b[1] << 8)).toString(16).toUpperCase().padStart(4, '0')}`;

const VFO_ROWS: readonly Row[] = [
  [
    0x00,
    8,
    'Frequency',
    '8 bytes, one digit each, MMM.MMMMM',
    '',
    'Radio repo F302-F309 trace',
    (b) => digitsText(b, 3, 'MHz'),
  ],
  [
    0x08,
    2,
    'RX tone',
    'u16 LE, the channel record tone encoding (shown raw); decoding inferred',
    '',
    'Radio repo F302-F309 trace; inferred',
    toneText,
    'partly',
  ],
  [
    0x0a,
    2,
    'TX tone',
    'u16 LE, the channel record tone encoding (shown raw)',
    '',
    'Radio repo F302-F309 trace',
    toneText,
  ],
  [
    0x0e,
    1,
    'Shift direction',
    'Bits 6:5: 1 +, 2 −',
    '',
    'Radio repo F302-F309 trace',
    (b) =>
      ({ 0: 'None', 1: '+', 2: '−' })[bits(0x60, 5)(b)] ?? `${bits(0x60, 5)(b)} (not in the table)`,
  ],
  [
    0x0e,
    1,
    'Signalling code',
    'Bits 4:0',
    '',
    'Radio repo F302-F309 trace',
    (b) => String(bits(0x1f, 0)(b)),
  ],
  [
    0x10,
    1,
    'Power index',
    '0 High, 1 Low; also the PA bias frame index',
    '',
    'Radio repo F302-F309 trace',
    pick({ 0: 'High', 1: 'Low' }),
  ],
  [
    0x11,
    1,
    'Bandwidth',
    'Bit 6',
    '',
    'Radio repo F302-F309 trace',
    (b) => `Bit 6 ${(b[0] >> 6) & 1 ? 'set' : 'clear'}`,
  ],
  [
    0x11,
    1,
    'Encryption (frequency hopping)',
    'Bit 0',
    '',
    'Radio repo F302-F309 trace',
    (b) => ((b[0] & 1) === 1 ? 'On' : 'Off'),
  ],
  [
    0x13,
    1,
    'Step index',
    '0-8, 2.5 … 100 kHz',
    '',
    'Radio repo F302-F309 trace',
    (b) => (b[0] <= 8 ? `Index ${b[0]}` : unlisted(b[0])),
  ],
  [
    0x14,
    7,
    'Offset',
    '7 digits, MMM.MMMM MHz',
    '',
    'Radio repo F302-F309 trace',
    (b) => digitsText(b, 3, 'MHz'),
  ],
  [0x1b, 1, 'SP-Mute', 'Raw', '', 'Radio repo F302-F309 trace', raw],
];

/**
 * One VFO record's fields: 24 bytes named (22 traced, 2 inferred), 8 with no reader. Busy lockout in VFO mode is
 * settings byte `0x0F`, not here. CHIRP has 6 offset digits and `sqmode` at `+0x1C`; the firmware writes 7 digits and
 * SP-Mute at `+0x1B`.
 */
export const UV5R_MINI_VFO_FIELDS: readonly Uv5rMiniFrameField[] = [
  ...VFO_ROWS.map(toField),
  noReader(0x0c, 2, '', 'traced', 'No reader found (static)'),
  noReader(0x0f, 1, '', 'traced', 'No reader found (static)'),
  noReader(0x12, 1, '', 'traced', 'No reader found (static)'),
  noReader(0x1c, 4, '', 'traced', 'No reader found (static)'),
].sort((a, b) => a.offset - b.offset);

export interface Uv5rMiniVfoValue {
  /** `A` or `B`. */
  side: 'A' | 'B';
  fields: Uv5rMiniFrameFieldValue[];
}

export interface Uv5rMiniVfo {
  sides: Uv5rMiniVfoValue[];
  counts: Uv5rMiniFrameCounts;
}

/** Decode both VFO records of a decoded 64 KiB full read. Read only: returns copies. */
export function decodeUv5rMiniVfo(decoded: Uint8Array): Uv5rMiniVfo {
  checkSize(decoded, 'VFO frame');
  const sides = (['A', 'B'] as const).map((side, s) => {
    const base = UV5R_MINI_VFO_START + s * UV5R_MINI_VFO_RECORD_SIZE;
    return {
      side,
      fields: UV5R_MINI_VFO_FIELDS.map((field) => {
        const bytes = decoded.slice(base + field.offset, base + field.offset + field.length);
        return { field, address: base + field.offset, bytes, text: field.format(bytes) };
      }),
    };
  });
  return { sides, counts: uv5rMiniFrameCounts(UV5R_MINI_VFO_FIELDS) };
}
