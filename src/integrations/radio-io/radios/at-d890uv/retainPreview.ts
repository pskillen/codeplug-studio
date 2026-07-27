/**
 * Retain-only LocalInfo / ExpertOptions preview for AT-D890UV Radio image UI.
 * Cite: anytone-cps ExpertOptions + docs/reference/radios/anytone/at-d890uv/memory-layout.md
 */

import { AT_D890_BLOCK_SIZE, D890_MAP } from './constants.ts';

export interface AtD890RetainPreviewRow {
  /** Absolute radio address, when known. */
  address: string;
  offset: string;
  label: string;
  value: string;
}

export interface AtD890RegisterRow {
  address: string;
  offset: string;
  region: string;
  role: 'kept' | 'replaced';
  hex: string;
  ascii: string;
  notes: string;
}

function hexByte(n: number): string {
  return (n & 0xff).toString(16).padStart(2, '0').toUpperCase();
}

function hexAddress(n: number): string {
  return `0x${n.toString(16).toLowerCase()}`;
}

function offsetLabel(off: number): string {
  return `+0x${off.toString(16).toLowerCase()}`;
}

function readAsciiField(data: Uint8Array, offset: number, length: number): string {
  const slice = data.subarray(offset, Math.min(data.length, offset + length));
  let end = slice.length;
  for (let i = 0; i < slice.length; i++) {
    if (slice[i] === 0 || slice[i] === 0xff) {
      end = i;
      break;
    }
  }
  const chars: string[] = [];
  for (let i = 0; i < end; i++) {
    const c = slice[i]!;
    chars.push(c >= 0x20 && c < 0x7f ? String.fromCharCode(c) : '.');
  }
  return chars.join('').trim();
}

function asciiPreview(data: Uint8Array): string {
  return [...data].map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')).join('');
}

function hexDump(data: Uint8Array): string {
  return [...data].map(hexByte).join(' ');
}

function bit0(byte: number): boolean {
  return (byte & 1) !== 0;
}

/** Known ExpertOptions / LocalInfo fields (kept on Write — read for preview, not serial-written). */
export function settingsRetainPreview(localInfo: Uint8Array): AtD890RetainPreviewRow[] {
  if (localInfo.length === 0) return [];
  const base = D890_MAP.LocalInfo;
  const rows: AtD890RetainPreviewRow[] = [];

  const push = (off: number, label: string, value: string) => {
    rows.push({
      address: hexAddress(base + off),
      offset: offsetLabel(off),
      label,
      value,
    });
  };

  const b2 = localInfo[0x02] ?? 0;
  push(0x02, 'Full test mode (bit 0)', bit0(b2) ? 'On' : 'Off');

  const freqMode = localInfo[0x03] ?? 0;
  push(0x03, 'Frequency mode', String(freqMode));

  const c4 = localInfo[0x04] ?? 0xff;
  const c5 = localInfo[0x05] ?? 0xff;
  push(
    0x04,
    'Chinese UI (+0x04/+0x05)',
    c4 === 0 && c5 === 0 ? 'Chinese (both 0)' : `Not Chinese (${hexByte(c4)} ${hexByte(c5)})`,
  );

  const b6 = localInfo[0x06] ?? 0;
  push(0x06, 'Band select (bit 0)', bit0(b6) ? 'On' : 'Off');

  push(0x0b, 'Band-settings password', readAsciiField(localInfo, 0x0b, 4) || '(empty)');
  push(0x10, 'Radio type', readAsciiField(localInfo, 0x10, 7) || '(empty)');
  push(0x28, 'Program password', readAsciiField(localInfo, 0x28, 4) || '(empty)');
  push(0x2c, 'Area code', readAsciiField(localInfo, 0x2c, 4) || '(empty)');
  push(0x30, 'Serial number', readAsciiField(localInfo, 0x30, 0x10) || '(empty)');
  push(0x40, 'Production date', readAsciiField(localInfo, 0x40, 0x10) || '(empty)');
  push(0x50, 'Manufacture code', readAsciiField(localInfo, 0x50, 8) || '(empty)');
  push(0x60, 'Maintenance date', readAsciiField(localInfo, 0x60, 0x10) || '(empty)');
  push(0x70, 'Dealer code', readAsciiField(localInfo, 0x70, 0x10) || '(empty)');
  push(0x80, 'Stock date', readAsciiField(localInfo, 0x80, 0x10) || '(empty)');
  push(0x90, 'Sell date', readAsciiField(localInfo, 0x90, 0x10) || '(empty)');
  push(0xa0, 'Seller', readAsciiField(localInfo, 0xa0, 0x10) || '(empty)');
  push(0xb0, 'Maintenance description', readAsciiField(localInfo, 0xb0, 0x50) || '(empty)');

  return rows;
}

const AT_D890_CPS_LANGUAGE = ['English', 'German'] as const;
const AT_D890_POWERON_INTERFACE = ['Default Interface', 'Custom Char', 'Custom Picture'] as const;

function enumLabel<T extends readonly string[]>(
  values: T,
  index: number,
  fallback: string,
): string {
  return values[index] ?? `${fallback} (${index})`;
}

/**
 * Optional settings forensic preview (Read/stash only — never serial-written).
 * Chinese UI lives in LocalInfo ExpertOptions, not CPS language here.
 */
export function optionalSettingsRetainPreview(
  main: Uint8Array,
  ext: Uint8Array,
): AtD890RetainPreviewRow[] {
  if (main.length === 0 && ext.length === 0) return [];
  const baseMain = D890_MAP.OptionalSettingsMain;
  const baseExt = D890_MAP.OptionalSettingsExt;
  const rows: AtD890RetainPreviewRow[] = [];

  const pushMain = (off: number, label: string, value: string) => {
    rows.push({
      address: hexAddress(baseMain + off),
      offset: offsetLabel(off),
      label,
      value,
    });
  };
  const pushExt = (off: number, label: string, value: string) => {
    rows.push({
      address: hexAddress(baseExt + off),
      offset: offsetLabel(off),
      label,
      value,
    });
  };

  rows.push({
    address: hexAddress(D890_MAP.LocalInfo + 0x04),
    offset: '+0x04/+0x05',
    label: 'Chinese UI (Expert options)',
    value: 'See Local info above — separate from CPS language below',
  });

  if (main.length > 0) {
    const iface = main[0x06] ?? 0;
    pushMain(0x06, 'Power-on interface', enumLabel(AT_D890_POWERON_INTERFACE, iface, 'unknown'));
    const lang = main[0x05] ?? 0;
    pushMain(0x05, 'CPS language', enumLabel(AT_D890_CPS_LANGUAGE, lang, 'unknown'));
    const pwdEnable = main[0x07] ?? 0;
    pushMain(0x07, 'Power-on password enable', bit0(pwdEnable) ? 'On' : 'Off');
    pushMain(0xd7, 'Default startup channel', String(main[0xd7] ?? 0));
    pushMain(0xd8, 'Startup zone A', String(main[0xd8] ?? 0));
    pushMain(0xd9, 'Startup zone B', String(main[0xd9] ?? 0));
    pushMain(0xda, 'Startup channel A', String(main[0xda] ?? 0));
    pushMain(0xdb, 'Startup channel B', String(main[0xdb] ?? 0));
  }

  if (ext.length > 0) {
    pushExt(0x00, 'Power-on display line 1', readAsciiField(ext, 0x00, 14) || '(empty)');
    pushExt(0x10, 'Power-on display line 2', readAsciiField(ext, 0x10, 14) || '(empty)');
    const pwd = readAsciiField(ext, 0x20, 8) || '(empty)';
    pushExt(0x20, 'Power-on password (sensitive)', pwd);
  }

  return rows;
}

/** APRS optional buffer — hex preview only. */
export function optionalSettingsAprsPreview(aprs: Uint8Array): AtD890RetainPreviewRow[] {
  if (aprs.length === 0) return [];
  const preview = hexDump(aprs.subarray(0, Math.min(aprs.length, 16)));
  const suffix = aprs.length > 16 ? '…' : '';
  return [
    {
      address: hexAddress(D890_MAP.OptionalSettingsAprs),
      offset: '+0x00',
      label: 'GPS/APRS info (hex)',
      value: `${preview}${suffix} (${aprs.length} bytes)`,
    },
  ];
}

/** Light alarm forensic rows (Read/stash only). */
export function alarmRetainPreview(
  main: Uint8Array,
  alarmBitmap: Uint8Array,
  alarmData: Uint8Array,
): AtD890RetainPreviewRow[] {
  const rows: AtD890RetainPreviewRow[] = [];
  const pushBitmap = (off: number, label: string, value: string) => {
    rows.push({
      address: hexAddress(D890_MAP.AlarmBitmap + off),
      offset: offsetLabel(off),
      label,
      value,
    });
  };
  const pushData = (off: number, label: string, value: string) => {
    rows.push({
      address: hexAddress(D890_MAP.AlarmData + off),
      offset: offsetLabel(off),
      label,
      value,
    });
  };

  if (main.length > 0x24) {
    rows.push({
      address: hexAddress(D890_MAP.OptionalSettingsMain + 0x24),
      offset: '+0x24',
      label: 'Man-down (optional main)',
      value: bit0(main[0x24]!) ? 'On' : 'Off',
    });
    if (main.length > 0x4f) {
      rows.push({
        address: hexAddress(D890_MAP.OptionalSettingsMain + 0x4f),
        offset: '+0x4f',
        label: 'Man-down delay (optional main)',
        value: String(main[0x4f] ?? 0),
      });
    }
  }

  if (alarmBitmap.length > 0) {
    pushBitmap(0x00, 'Digital call type', String(alarmBitmap[0] ?? 0));
  }

  if (alarmData.length > 0) {
    pushData(0x00, 'Analog emergency alarm', bit0(alarmData[0]!) ? 'On' : 'Off');
  }
  if (alarmData.length > 0x0a) {
    pushData(0x0a, 'Digital emergency alarm', bit0(alarmData[0x0a]!) ? 'On' : 'Off');
  }

  return rows;
}

const LOCAL_INFO_FIELD_HINTS: { start: number; end: number; label: string }[] = [
  { start: 0x02, end: 0x03, label: 'full test mode' },
  { start: 0x03, end: 0x04, label: 'frequency mode' },
  { start: 0x04, end: 0x06, label: 'Chinese UI' },
  { start: 0x06, end: 0x07, label: 'band select' },
  { start: 0x0b, end: 0x0f, label: 'band password' },
  { start: 0x10, end: 0x17, label: 'radio type' },
  { start: 0x28, end: 0x2c, label: 'program password' },
  { start: 0x2c, end: 0x30, label: 'area code' },
  { start: 0x30, end: 0x40, label: 'serial number' },
  { start: 0x40, end: 0x50, label: 'production date' },
  { start: 0x50, end: 0x58, label: 'manufacture code' },
  { start: 0x60, end: 0x70, label: 'maintenance date' },
  { start: 0x70, end: 0x80, label: 'dealer code' },
  { start: 0x80, end: 0x90, label: 'stock date' },
  { start: 0x90, end: 0xa0, label: 'sell date' },
  { start: 0xa0, end: 0xb0, label: 'seller' },
  { start: 0xb0, end: 0x100, label: 'maintenance description' },
];

function notesForLocalInfoChunk(chunkOffset: number): string {
  const end = chunkOffset + AT_D890_BLOCK_SIZE;
  const hits = LOCAL_INFO_FIELD_HINTS.filter((h) => h.start < end && h.end > chunkOffset).map(
    (h) => h.label,
  );
  return hits.length > 0 ? hits.join(', ') : 'undocumented / padding';
}

/** 16-byte LocalInfo register rows (serial R/W quantum). */
export function localInfoRegisterPreview(localInfo: Uint8Array): AtD890RegisterRow[] {
  const rows: AtD890RegisterRow[] = [];
  const len = Math.min(localInfo.length, D890_MAP.LocalInfoLength);
  for (let off = 0; off < len; off += AT_D890_BLOCK_SIZE) {
    const chunk = localInfo.subarray(off, Math.min(len, off + AT_D890_BLOCK_SIZE));
    rows.push({
      address: hexAddress(D890_MAP.LocalInfo + off),
      offset: offsetLabel(off),
      region: 'Local info',
      role: 'kept',
      hex: hexDump(chunk),
      ascii: asciiPreview(chunk),
      notes: notesForLocalInfoChunk(off) + ' Not written on Studio Write.',
    });
  }
  return rows;
}

/** Regions documented but not in Studio v1 Read — shown as a UI note. */
export const AT_D890_NOT_IN_CAPTURE: readonly { address: string; label: string; note: string }[] = [
  {
    address: '—',
    label: 'DigitalContact*, boot/BK images, crypto, AM air, roaming, AnalogBook',
    note: 'Not in v1 Read/Write set',
  },
] as const;
