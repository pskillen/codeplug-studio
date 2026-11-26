import { describeRadioFoundrySettingsEntry } from '@core/import-export/formats/radiofoundry/m17.ts';
import {
  readRadioFoundrySettingsArea,
  settingsAreaSector,
} from '@core/import-export/formats/radiofoundry/settingsArea.ts';
import { SETTINGS_AREA_ADDRESS } from '@core/import-export/formats/radiofoundry/layout.ts';
import type { SettingsView, SettingRow } from '../../debugView/index.ts';
import { RADIOFOUNDRY_REGION } from './debugCapture.ts';
import { isRadioFoundrySecretKey } from './debugSensitive.ts';
import { radioFoundryCableBoardForModelId } from './board.ts';

type SettingsArchive = {
  manifest: { radioModelId: string; regions: { id: string }[] };
  regions: Record<string, Uint8Array>;
};

const hexAddress = (n: number) => `0x${n.toString(16)}`;
const hexSpaced = (bytes: Uint8Array) =>
  [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(' ');

function notCaptured(reason: string): SettingsView {
  return {
    status: { kind: 'not-captured', reason },
    summary: reason,
    intro: '',
    groups: [],
  };
}

function ambiguous(reason: string): SettingsView {
  return {
    status: { kind: 'ambiguous', reason },
    summary: reason,
    intro: '',
    groups: [],
  };
}

/** RadioFoundry Settings tab: raw settings-area entries with masked secret families. */
export function radioFoundrySettingsView(archive: SettingsArchive): SettingsView {
  if (!radioFoundryCableBoardForModelId(archive.manifest.radioModelId)) {
    return notCaptured('Not a RadioFoundry archive.');
  }
  const region = archive.regions[RADIOFOUNDRY_REGION.eeprom];
  if (!region || !archive.manifest.regions.some((r) => r.id === RADIOFOUNDRY_REGION.eeprom)) {
    return notCaptured('The EEPROM image was not captured.');
  }
  let sector: Uint8Array;
  try {
    sector = settingsAreaSector(region);
  } catch {
    return notCaptured('The EEPROM image was not captured.');
  }
  const area = readRadioFoundrySettingsArea(sector);
  if (area.state === 'bad') {
    return ambiguous("The settings area doesn't parse; the radio treats it as empty.");
  }
  if (area.state === 'newer') {
    return ambiguous('The settings area is a newer version than Studio reads.');
  }
  if (area.state === 'empty') {
    return {
      status: { kind: 'ok' },
      summary: 'Settings area erased',
      intro: 'The settings area is erased (no entries).',
      groups: [
        {
          id: 'entries',
          label: 'Settings area entries',
          emptyText: 'The settings area is erased (no entries).',
          rows: [],
        },
      ],
    };
  }
  const seenKeys = new Map<number, number>();
  const rows: SettingRow[] = area.entries.map((entry, index) => {
    const dup = seenKeys.has(entry.key);
    seenKeys.set(entry.key, (seenKeys.get(entry.key) ?? 0) + 1);
    const described = describeRadioFoundrySettingsEntry(entry.key, entry.value);
    return {
      id: `kv-${index}`,
      label: described ?? `Key 0x${entry.key.toString(16).padStart(4, '0')}`,
      help: `${entry.value.length} bytes`,
      value: hexSpaced(entry.value),
      raw: [...entry.value],
      address: hexAddress(SETTINGS_AREA_ADDRESS + entry.offset),
      confidence: 'unknown',
      sensitive: isRadioFoundrySecretKey(entry.key),
      evidence: dup ? 'duplicate, the radio reads the first' : undefined,
    };
  });
  return {
    status: { kind: 'ok' },
    summary: `Settings area version ${area.version} · ${area.entries.length} entries`,
    intro:
      'Entries as stored. M17 channel tags and the M17 callsign are named; other keys stay numbered. Secret and traffic-key values are masked.',
    groups: [{ id: 'entries', label: 'Settings area entries', rows }],
  };
}
