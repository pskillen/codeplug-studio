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
  return [...data]
    .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.'))
    .join('');
}

function hexDump(data: Uint8Array): string {
  return [...data].map(hexByte).join(' ');
}

function bit0(byte: number): boolean {
  return (byte & 1) !== 0;
}

/** Known ExpertOptions / LocalInfo fields (kept on Write — replayed verbatim). */
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
  push(
    0xb0,
    'Maintenance description',
    readAsciiField(localInfo, 0xb0, 0x50) || '(empty)',
  );

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
      notes: notesForLocalInfoChunk(off),
    });
  }
  return rows;
}

/** Regions documented but not in Studio v1 Read — shown as a UI note. */
export const AT_D890_NOT_IN_CAPTURE: readonly { address: string; label: string; note: string }[] = [
  {
    address: '0x3500000',
    label: 'Optional settings (main)',
    note: 'UI language, power-on password enable — not Read',
  },
  {
    address: '0x3500900',
    label: 'Optional settings (ext)',
    note: 'Power-on password chars — not Read',
  },
  {
    address: '0x3501280',
    label: 'Optional settings (APRS)',
    note: 'Not Read',
  },
  {
    address: '0x3482e00',
    label: 'Alarm settings',
    note: 'Not Read',
  },
  {
    address: '—',
    label: 'DigitalContact*, boot/BK images, crypto, AM air, roaming, AnalogBook',
    note: 'Not in v1 Read/Write set',
  },
] as const;
