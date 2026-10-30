import { describe, expect, it } from 'vitest';
import { RT95_ALL_SETTINGS_FIELD_IDS } from '@core/radios/retevis/rt95/radioSettings.ts';
import { decodeRt95RadioSettings, readRt95SettingsSnapshotFromImage } from './settingsCodec.ts';
import { RT95_SETTINGS_FIELDS } from './settingsFields.ts';

describe('decodeRt95RadioSettings', () => {
  it('decodes every registered field from a blank image', () => {
    const image = new Uint8Array(0x32a0);
    const snap = readRt95SettingsSnapshotFromImage(image);
    const decoded = decodeRt95RadioSettings(snap, 'stock');
    for (const id of RT95_ALL_SETTINGS_FIELD_IDS) {
      expect(decoded[id], id).toBeDefined();
    }
  });

  it('round-trips beep volume', () => {
    const image = new Uint8Array(0x32a0);
    const spec = RT95_SETTINGS_FIELDS.get('beepVolume')!;
    image[0x3200] = 0xf0 | 4;
    const snap = readRt95SettingsSnapshotFromImage(image);
    expect(decodeRt95RadioSettings(snap, 'stock').beepVolume?.value).toBe(4);
    const bytes = spec.encode(4);
    expect(spec.decode(bytes)).toBe(4);
  });
});
