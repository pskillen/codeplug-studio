/**
 * Retain-only shallow decoders for DM-32UV Radio image UI.
 * Excludes APRS slice (0x301–0x334) — written from build.
 * Cite: docs/reference/radios/baofeng/dm-32uv/settings.md
 */

import { DM32_METADATA } from './constants.ts';
import {
  countEncryptionKeysInBlock,
  countQuickMessagesInBlock,
  countRadioIdsInBlock,
  readAsciiLine,
  type Dm32SparseBlockInput,
} from './retainCounts.ts';

export interface Dm32RetainPreviewRow {
  label: string;
  value: string;
}

const AUTO_POWER_OFF_LABELS = [
  'Off',
  '30 minutes',
  '1 hour',
  '2 hours',
  '3 hours',
  '4 hours',
] as const;

const SIDE_KEY_LABELS: Record<number, string> = {
  0: 'None',
  1: 'Monitor',
  2: 'Scan',
  3: 'VOX',
  4: 'Emergency',
  5: 'Zone select',
  6: 'Power level',
  7: 'Talkaround',
};

function sideKeyLabel(byte: number): string {
  return SIDE_KEY_LABELS[byte & 0x7f] ?? `Function ${byte}`;
}

/** Shallow retain fields from settings block (metadata 0x04), excluding APRS. */
export function settingsRetainPreview(data: Uint8Array): Dm32RetainPreviewRow[] {
  const rows: Dm32RetainPreviewRow[] = [];

  const line1 = readAsciiLine(data, 0x01, 14);
  const line2 = readAsciiLine(data, 0x0f, 14);
  if (line1) rows.push({ label: 'Power-on display line 1', value: line1 });
  if (line2) rows.push({ label: 'Power-on display line 2', value: line2 });

  const apo = data[0x1e] ?? 0;
  if (apo < AUTO_POWER_OFF_LABELS.length) {
    rows.push({ label: 'Auto power off', value: AUTO_POWER_OFF_LABELS[apo]! });
  }

  const gpsOn = (data[0x40] ?? 0) & 1;
  rows.push({ label: 'GPS', value: gpsOn ? 'On' : 'Off' });

  const backlight = data[0x30] ?? 0;
  if (backlight > 0 && backlight < 10) {
    rows.push({ label: 'Backlight level', value: String(backlight) });
  }

  const keyLock = data[0x85] ?? 0;
  rows.push({ label: 'Key lock', value: keyLock ? 'On' : 'Off' });

  const sk1Short = data[0x87] ?? 0;
  const sk1Long = data[0x88] ?? 0;
  const sk2Short = data[0x89] ?? 0;
  const sk2Long = data[0x8a] ?? 0;
  if (sk1Short || sk1Long) {
    rows.push({
      label: 'Side key 1',
      value: `${sideKeyLabel(sk1Short)} (short) / ${sideKeyLabel(sk1Long)} (long)`,
    });
  }
  if (sk2Short || sk2Long) {
    rows.push({
      label: 'Side key 2',
      value: `${sideKeyLabel(sk2Short)} (short) / ${sideKeyLabel(sk2Long)} (long)`,
    });
  }

  const pf1Short = data[0x8d] ?? 0;
  const pf1Long = data[0x8e] ?? 0;
  if (pf1Short || pf1Long) {
    rows.push({
      label: 'Programmable key 1',
      value: `${sideKeyLabel(pf1Short)} (short) / ${sideKeyLabel(pf1Long)} (long)`,
    });
  }

  return rows;
}

export interface Dm32AncillaryRetainPreview {
  quickMessageCount: number;
  digitalEmergencyCount: number;
  analogEmergencyCount: number;
  encryptionKeyCount: number;
  radioIdCount: number;
  hasCalibration: boolean;
}

export function ancillaryRetainPreview(
  blocks: readonly Dm32SparseBlockInput[],
): Dm32AncillaryRetainPreview {
  let quickMessageCount = 0;
  let digitalEmergencyCount = 0;
  let analogEmergencyCount = 0;
  let encryptionKeyCount = 0;
  let radioIdCount = 0;
  let hasCalibration = false;

  for (const b of blocks) {
    if (b.metadata === DM32_METADATA.QUICK_MESSAGES) {
      quickMessageCount += countQuickMessagesInBlock(b.data);
    } else if (b.metadata === 0x03) {
      let count = 0;
      for (let off = 0; off + 20 <= b.data.length; off += 20) {
        if (b.data[off] === 0 || b.data[off] === 0xff) break;
        count += 1;
      }
      digitalEmergencyCount += Math.min(count, 16);
    } else if (b.metadata === DM32_METADATA.ANALOG_EMERGENCY) {
      let count = 0;
      for (let off = 0; off + 36 <= b.data.length; off += 36) {
        if (b.data[off] === 0 || b.data[off] === 0xff) break;
        count += 1;
      }
      analogEmergencyCount += Math.min(count, 16);
      encryptionKeyCount += countEncryptionKeysInBlock(b.data);
    } else if (b.metadata === DM32_METADATA.DMR_RADIO_IDS) {
      radioIdCount += countRadioIdsInBlock(b.data);
    } else if (b.metadata === DM32_METADATA.CALIBRATION) {
      hasCalibration = true;
    }
  }

  return {
    quickMessageCount,
    digitalEmergencyCount,
    analogEmergencyCount,
    encryptionKeyCount,
    radioIdCount,
    hasCalibration,
  };
}
