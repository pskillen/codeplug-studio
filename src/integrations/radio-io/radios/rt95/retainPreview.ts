/**
 * Retain-only shallow decoders for RT95 Radio image UI.
 */

import { RT95_BANDLIMIT_OFFSET } from './constants.ts';

export interface Rt95RetainPreviewRow {
  label: string;
  value: string;
}

const SETTINGS_OFFSET = 0x3200;

export function settingsRetainPreview(bytes: Uint8Array): Rt95RetainPreviewRow[] {
  if (bytes.length < RT95_BANDLIMIT_OFFSET + 1) return [];

  const squelchA = bytes[SETTINGS_OFFSET + 0x04]! & 0x0f;
  const squelchB = bytes[SETTINGS_OFFSET + 0x05]! & 0x0f;
  const speakerVol = bytes[SETTINGS_OFFSET + 0x06]! & 0x3f;
  const voxOn = (bytes[SETTINGS_OFFSET + 0x1c]! & 0x80) !== 0;
  const voxLevel = bytes[SETTINGS_OFFSET + 0x1d]!;
  const voxDelay = bytes[SETTINGS_OFFSET + 0x1e]!;
  const bandlimit = bytes[RT95_BANDLIMIT_OFFSET]!;

  return [
    { label: 'Squelch A', value: String(squelchA) },
    { label: 'Squelch B', value: String(squelchB) },
    { label: 'Speaker volume', value: String(speakerVol) },
    { label: 'VOX', value: voxOn ? `On (level ${voxLevel}, delay ${voxDelay})` : 'Off' },
    { label: 'Bandlimit index', value: `0x${bandlimit.toString(16).padStart(2, '0')}` },
  ];
}
