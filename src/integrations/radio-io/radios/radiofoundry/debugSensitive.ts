import {
  SETTINGS_AREA_ADDRESS,
  SETTINGS_AREA_SIZE,
} from '@core/import-export/formats/radiofoundry/layout.ts';
import { readRadioFoundrySettingsArea } from '@core/import-export/formats/radiofoundry/settingsArea.ts';
import type { DebugSensitiveArchive, DebugSensitiveRange } from '../../debugSensitive.ts';
import { radioFoundryCableBoardForModelId } from './board.ts';
import { RADIOFOUNDRY_REGION } from './debugCapture.ts';

const MAGIC = [0x52, 0x46, 0x4b, 0x56] as const;

const FIXED_SPANS: readonly { start: number; end: number; label: string }[] = [
  { start: 0x100, end: 0x108, label: 'Codeplug password' },
  { start: 0x751c, end: 0x751f, label: 'Boot PIN' },
  { start: 0x1408, end: 0x1418, label: 'DTMF kill code' },
  { start: 0x1418, end: 0x1428, label: 'DTMF wake code' },
];

function clipRange(
  range: DebugSensitiveRange,
  regionAddress: number,
  regionLength: number,
): DebugSensitiveRange | undefined {
  const regionEnd = regionAddress + regionLength;
  const start = Math.max(range.start, regionAddress);
  const end = Math.min(range.end, regionEnd);
  return start < end ? { start, end, label: range.label } : undefined;
}

/** True for system-secret and traffic-key families masked in Settings, Hex and Compare. */
export function isRadioFoundrySecretKey(key: number): boolean {
  return (key >= 0x0300 && key <= 0x03ff) || (key >= 0x1900 && key <= 0x1cff);
}

function secretLabel(key: number): string | undefined {
  if (!isRadioFoundrySecretKey(key)) return undefined;
  if (key >= 0x0300 && key <= 0x03ff) {
    return `System secret 0x${key.toString(16).padStart(4, '0')}`;
  }
  return `Traffic key 0x${key.toString(16).padStart(4, '0')}`;
}

function settingsSensitiveRanges(bytes: Uint8Array): readonly DebugSensitiveRange[] {
  if (bytes.length < SETTINGS_AREA_ADDRESS + SETTINGS_AREA_SIZE) return [];
  const sector = bytes.subarray(SETTINGS_AREA_ADDRESS, SETTINGS_AREA_ADDRESS + SETTINGS_AREA_SIZE);
  const area = readRadioFoundrySettingsArea(sector);
  if (area.state === 'empty') return [];
  if (area.state === 'bad' || area.state === 'newer') {
    return [
      {
        start: SETTINGS_AREA_ADDRESS,
        end: SETTINGS_AREA_ADDRESS + SETTINGS_AREA_SIZE,
        label: 'Settings area (unreadable, masked whole)',
      },
    ];
  }
  if (area.state !== 'valid') return [];
  const out: DebugSensitiveRange[] = [];
  for (const entry of area.entries) {
    if (entry.value.length === 0) continue;
    const label = secretLabel(entry.key);
    if (!label) continue;
    const start = SETTINGS_AREA_ADDRESS + entry.offset;
    out.push({ start, end: start + entry.value.length, label });
  }
  if (
    MAGIC.every((m, i) => sector[i] === m) &&
    !sector.subarray(12, 16).every((b) => b === 0)
  ) {
    out.push({
      start: 0xf000,
      end: 0x10000,
      label: 'Settings area continuation',
    });
  }
  return out;
}

/** Secret byte ranges inside a RadioFoundry `eeprom-image` region; nothing for other radios or regions. */
export function radioFoundryArchiveSensitiveRanges(
  archive: DebugSensitiveArchive,
  regionId: string,
): readonly DebugSensitiveRange[] {
  if (!radioFoundryCableBoardForModelId(archive.manifest.radioModelId)) return [];
  if (regionId !== RADIOFOUNDRY_REGION.eeprom) return [];
  const region = archive.manifest.regions.find((r) => r.id === regionId);
  const bytes = archive.regions[regionId];
  if (!region || !bytes) return [];
  const ranges: DebugSensitiveRange[] = [
    ...FIXED_SPANS.map((span) => ({ ...span })),
    ...settingsSensitiveRanges(bytes),
  ];
  return ranges.flatMap((r) => {
    const clipped = clipRange(r, region.address, bytes.length);
    return clipped ? [clipped] : [];
  });
}