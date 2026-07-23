/**
 * Retain-only shallow decoders for UV-5R Mini Radio image UI.
 * Cite: NeonPlug settingsFormat.ts (MIT facts); tier-3 settings.md
 */

import {
  UV5R_MINI_ANI_OFFSET,
  UV5R_MINI_ANI_SIZE,
  UV5R_MINI_DOWNCODE_OFFSET,
  UV5R_MINI_DOWNCODE_SIZE,
  UV5R_MINI_PTT_ID_OFFSET,
  UV5R_MINI_PTT_ID_SIZE,
  UV5R_MINI_SETTINGS_OFFSET,
  UV5R_MINI_SETTINGS_SIZE,
  UV5R_MINI_UPCODE_OFFSET,
  UV5R_MINI_UPCODE_SIZE,
  UV5R_MINI_VFO_A_OFFSET,
  UV5R_MINI_VFO_B_OFFSET,
  UV5R_MINI_VFO_SIZE,
} from './constants.ts';
import { decodeChannelRecord } from './channelCodec.ts';

export interface Uv5rMiniRetainPreviewRow {
  label: string;
  value: string;
}

const SQUELCH_LIST = ['Off', '1', '2', '3', '4', '5'] as const;
const LIST_PTTID = ['Off', 'BOT', 'EOT', 'Both'] as const;
const LIST_TIMEOUT = [
  'Off',
  ...Array.from({ length: 12 }, (_, i) => `${15 + i * 15} sec`),
] as const;
const LIST_DUAL_WATCH = ['Off', 'On'] as const;
const LIST_POWERON_DISPLAY = ['LOGO', 'Battery voltage'] as const;
const LIST_VOICE = ['English', 'Chinese'] as const;
const LIST_BACKLIGHT = [
  'Always on',
  ...Array.from({ length: 4 }, (_, i) => `${5 + i * 5} sec`),
] as const;
const LIST_BEEP = ['Off', 'On'] as const;
const LIST_MODE = ['Name', 'Frequency', 'Channel number'] as const;
const LIST_SCANMODE = ['Time', 'Carrier', 'Search'] as const;
const LIST_WORKMODE = ['Frequency', 'Channel'] as const;
const LIST_VOX_LEVEL = ['Off', ...Array.from({ length: 9 }, (_, i) => String(i + 1))] as const;
const LIST_PW_SAVEMODE = ['Off', 'On'] as const;

function pick<T extends readonly string[]>(list: T, index: number): string {
  if (index < 0 || index >= list.length) return String(index);
  return list[index]!;
}

function formatMHz(hz: number): string {
  if (hz <= 0) return '—';
  const mhz = hz / 1_000_000;
  return `${mhz.toFixed(3)} MHz`;
}

function readPrintableRegion(bytes: Uint8Array, offset: number, size: number): string | null {
  if (offset + size > bytes.length) return null;
  const slice = bytes.subarray(offset, offset + size);
  let end = 0;
  while (end < slice.length) {
    const b = slice[end]!;
    if (b === 0x00 || b === 0xff) break;
    if (b < 0x20 || b > 0x7e) return null;
    end++;
  }
  if (end === 0) return null;
  return String.fromCharCode(...slice.subarray(0, end)).trim();
}

function regionPresence(bytes: Uint8Array, offset: number, size: number): string {
  if (offset + size > bytes.length) return 'Not in image';
  const slice = bytes.subarray(offset, offset + size);
  const allFf = slice.every((b) => b === 0xff);
  const allZero = slice.every((b) => b === 0);
  if (allFf || allZero) return 'Empty';
  const text = readPrintableRegion(bytes, offset, Math.min(size, 16));
  if (text) return text;
  return 'Present (opaque)';
}

function decodeVfoSummary(
  bytes: Uint8Array,
  offset: number,
  label: string,
): Uv5rMiniRetainPreviewRow {
  if (offset + UV5R_MINI_VFO_SIZE > bytes.length) {
    return { label, value: 'Not in image' };
  }
  const raw = bytes.subarray(offset, offset + UV5R_MINI_VFO_SIZE);
  if (raw[0] === 0xff) {
    return { label, value: 'Empty' };
  }
  try {
    const ch = decodeChannelRecord(raw, 0);
    const rx = formatMHz(ch.rxHz);
    const tx = ch.txHz !== ch.rxHz ? ` · TX ${formatMHz(ch.txHz)}` : '';
    return { label, value: `${rx}${tx} · ${ch.bandwidth}` };
  } catch {
    return { label, value: 'Present (opaque)' };
  }
}

/** Shallow retain fields from settings block @ packed 0x8040. */
export function settingsRetainPreview(bytes: Uint8Array): Uv5rMiniRetainPreviewRow[] {
  if (bytes.length < UV5R_MINI_SETTINGS_OFFSET + UV5R_MINI_SETTINGS_SIZE) {
    return [];
  }
  const s = bytes.subarray(
    UV5R_MINI_SETTINGS_OFFSET,
    UV5R_MINI_SETTINGS_OFFSET + UV5R_MINI_SETTINGS_SIZE,
  );
  const chbworkmode = s[26]! & 0x0f;
  const chaworkmode = (s[26]! >> 4) & 0x0f;

  return [
    { label: 'Squelch', value: pick(SQUELCH_LIST, s[0]!) },
    { label: 'Power save', value: pick(LIST_PW_SAVEMODE, s[1]!) },
    { label: 'VOX', value: pick(LIST_VOX_LEVEL, s[2]!) },
    { label: 'Backlight', value: pick(LIST_BACKLIGHT, s[3]!) },
    { label: 'Dual watch', value: pick(LIST_DUAL_WATCH, s[4]!) },
    { label: 'Time-out timer', value: pick(LIST_TIMEOUT, s[5]!) },
    { label: 'Beep', value: pick(LIST_BEEP, s[6]!) },
    { label: 'Voice', value: s[7]! ? pick(LIST_VOICE, s[8]!) : 'Off' },
    { label: 'Scan mode', value: pick(LIST_SCANMODE, s[10]!) },
    { label: 'PTT ID', value: pick(LIST_PTTID, s[11]!) },
    { label: 'Channel A display', value: pick(LIST_MODE, s[13]!) },
    { label: 'Channel B display', value: pick(LIST_MODE, s[14]!) },
    { label: 'Busy channel lockout', value: s[15]! ? 'On' : 'Off' },
    { label: 'Auto lock', value: s[16]! ? 'On' : 'Off' },
    { label: 'Roger beep', value: s[23]! ? 'On' : 'Off' },
    { label: 'Active VFO', value: s[24]! === 0 ? 'A' : 'B' },
    { label: 'FM radio', value: s[25]! ? 'On' : 'Off' },
    { label: 'VFO A work mode', value: pick(LIST_WORKMODE, chaworkmode) },
    { label: 'VFO B work mode', value: pick(LIST_WORKMODE, chbworkmode) },
    { label: 'Key lock', value: s[27]! ? 'On' : 'Off' },
    { label: 'Power-on display', value: pick(LIST_POWERON_DISPLAY, s[28]!) },
  ];
}

export interface Uv5rMiniAncillaryRetainPreview {
  rows: readonly Uv5rMiniRetainPreviewRow[];
}

export function ancillaryRetainPreview(bytes: Uint8Array): Uv5rMiniAncillaryRetainPreview {
  const rows: Uv5rMiniRetainPreviewRow[] = [
    decodeVfoSummary(bytes, UV5R_MINI_VFO_A_OFFSET, 'VFO A'),
    decodeVfoSummary(bytes, UV5R_MINI_VFO_B_OFFSET, 'VFO B'),
    { label: 'ANI', value: regionPresence(bytes, UV5R_MINI_ANI_OFFSET, UV5R_MINI_ANI_SIZE) },
    {
      label: 'PTT ID',
      value: regionPresence(bytes, UV5R_MINI_PTT_ID_OFFSET, UV5R_MINI_PTT_ID_SIZE),
    },
    {
      label: 'Upcode',
      value: regionPresence(bytes, UV5R_MINI_UPCODE_OFFSET, UV5R_MINI_UPCODE_SIZE),
    },
    {
      label: 'Downcode',
      value: regionPresence(bytes, UV5R_MINI_DOWNCODE_OFFSET, UV5R_MINI_DOWNCODE_SIZE),
    },
  ];
  return { rows };
}
