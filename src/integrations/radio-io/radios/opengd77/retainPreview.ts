/**
 * Retain-only shallow decoders for OpenGD77 / OpenUV380 Radio image UI.
 * Cite: docs/reference/radios/opengd77/settings-aprs.md
 */

import {
  OPENGD77_SETTINGS_SIZE,
  OPENGD77_VFO_SIZE,
  OPENUV380_OFFSET,
} from './constants.ts';
import { decodeChannelRecord } from './channelCodec.ts';
import { readAbs } from './memory.ts';
import type { MemoryMap } from '../../types.ts';

export interface OpenGd77RetainPreviewRow {
  label: string;
  value: string;
}

function readPrintable(bytes: Uint8Array, offset: number, len: number): string {
  let end = 0;
  const slice = bytes.subarray(offset, Math.min(offset + len, bytes.length));
  while (end < slice.length) {
    const b = slice[end]!;
    if (b === 0x00 || b === 0xff) break;
    if (b < 0x20 || b > 0x7e) break;
    end++;
  }
  return String.fromCharCode(...slice.subarray(0, end)).trim();
}

function formatMHz(hz: number): string {
  if (hz <= 0) return '—';
  return `${(hz / 1_000_000).toFixed(3)} MHz`;
}

function regionPresence(image: MemoryMap, abs: number, size: number): string {
  const slice = readAbs(image, abs, size);
  const allFf = slice.every((b) => b === 0xff);
  const allZero = slice.every((b) => b === 0);
  if (allFf || allZero) return 'Empty';
  const text = readPrintable(slice, 0, Math.min(size, 16));
  if (text) return text;
  return 'Present (opaque)';
}

function decodeVfoSummary(image: MemoryMap, abs: number, label: string): OpenGd77RetainPreviewRow {
  const raw = readAbs(image, abs, OPENGD77_VFO_SIZE);
  if (raw[0] === 0xff) {
    return { label, value: 'Empty' };
  }
  try {
    const ch = decodeChannelRecord(raw, 0);
    const rx = formatMHz(ch.rxHz);
    const tx = ch.txHz !== ch.rxHz ? ` · TX ${formatMHz(ch.txHz)}` : '';
    return { label, value: `${rx}${tx} · ${ch.mode}` };
  } catch {
    return { label, value: 'Present (opaque)' };
  }
}

/** Shallow retain fields from general settings @ FLASH 0x80. */
export function settingsRetainPreview(image: MemoryMap): OpenGd77RetainPreviewRow[] {
  const s = readAbs(image, OPENUV380_OFFSET.settings, OPENGD77_SETTINGS_SIZE);
  const rows: OpenGd77RetainPreviewRow[] = [];
  const call = readPrintable(s, 0x60, 8);
  if (call) rows.push({ label: 'Callsign', value: call });
  const idBytes = s.subarray(0x68, 0x68 + 4);
  if (!idBytes.every((b) => b === 0xff || b === 0)) {
    // DMR ID stored little-endian uint32 in OpenGD77 base settings (qdmr fact).
    const id = idBytes[0]! | (idBytes[1]! << 8) | (idBytes[2]! << 16) | (idBytes[3]! << 24);
    if (id > 0) rows.push({ label: 'DMR ID', value: String(id >>> 0) });
  }
  return rows;
}

export interface OpenGd77AncillaryRetainPreview {
  rows: readonly OpenGd77RetainPreviewRow[];
}

export function ancillaryRetainPreview(image: MemoryMap): OpenGd77AncillaryRetainPreview {
  const boot = readAbs(image, OPENUV380_OFFSET.bootSettings, 0x50);
  const line1 = readPrintable(boot, 0x28, 16);
  const line2 = readPrintable(boot, 0x38, 16);

  const rows: OpenGd77RetainPreviewRow[] = [
    decodeVfoSummary(image, OPENUV380_OFFSET.vfoA, 'VFO A'),
    decodeVfoSummary(image, OPENUV380_OFFSET.vfoB, 'VFO B'),
    { label: 'Boot line 1', value: line1 || '—' },
    { label: 'Boot line 2', value: line2 || '—' },
    {
      label: 'DTMF settings',
      value: regionPresence(image, OPENUV380_OFFSET.dtmfSettings, 0x40),
    },
    {
      label: 'DTMF contacts',
      value: regionPresence(image, OPENUV380_OFFSET.dtmfContacts, 0x40),
    },
    {
      label: 'FM APRS systems',
      value: regionPresence(image, OPENUV380_OFFSET.aprsSettings, 0x40),
    },
    {
      label: 'Additional settings',
      value: regionPresence(image, OPENUV380_OFFSET.additionalSettings, 0x40),
    },
  ];
  return { rows };
}
