import { describe, expect, it } from 'vitest';
import {
  AT_D890_V1_SETTINGS_FIELD_IDS,
  atD890SettingField,
} from '@core/radios/anytone/at-d890uv/radioSettings.ts';
import { D890_MAP } from './constants.ts';
import { decodeAtD890RadioSettings, languageLockFromLocalInfo } from './settingsCodec.ts';
import { AT_D890_SETTINGS_FIELDS, type AtD890SettingValue } from './settingsFields.ts';

function snapshotFrom(values: Record<string, AtD890SettingValue>) {
  const main = new Uint8Array(0x200);
  const ext = new Uint8Array(0x60);
  for (const [id, value] of Object.entries(values)) {
    const spec = AT_D890_SETTINGS_FIELDS.get(id)!;
    const bytes = spec.encode(value);
    const inMain = spec.address < D890_MAP.OptionalSettingsExt;
    const block = inMain ? main : ext;
    const at =
      spec.address - (inMain ? D890_MAP.OptionalSettingsMain : D890_MAP.OptionalSettingsExt);
    for (let i = 0; i < bytes.length; i++) {
      block[at + i] =
        spec.mask === undefined ? bytes[i]! : (block[at + i]! & ~spec.mask) | bytes[i]!;
    }
  }
  return { main, ext };
}

function highest(id: string): AtD890SettingValue {
  const def = atD890SettingField(id)!;
  if (def.kind === 'boolean') return true;
  if (def.kind === 'text') return 'MM9PDY TEST';
  return def.options![def.options!.length - 1]!.value;
}

describe('decodeAtD890RadioSettings', () => {
  it('decodes a synthetic snapshot built from encodes', () => {
    const values = Object.fromEntries(AT_D890_V1_SETTINGS_FIELD_IDS.map((id) => [id, highest(id)]));
    const decoded = decodeAtD890RadioSettings(snapshotFrom(values), 'stock');
    expect(Object.keys(decoded).sort()).toEqual([...AT_D890_V1_SETTINGS_FIELD_IDS].sort());
    for (const id of AT_D890_V1_SETTINGS_FIELD_IDS) {
      expect(decoded[id]!.value, id).toBe(values[id]);
    }
    expect(decoded.callSignColour).toMatchObject({ value: 7, raw: [7], label: 'Black' });
    expect(decoded.powerOnLine1).toMatchObject({ value: 'MM9PDY TEST' });
  });

  it('decodes the three masked +0x110 bits separately', () => {
    const decoded = decodeAtD890RadioSettings(
      snapshotFrom({ showChannelType: false, showTimeSlot: true, showColourCode: false }),
      'mm9pdy',
    );
    expect(decoded.showChannelType!.value).toBe(false);
    expect(decoded.showTimeSlot!.value).toBe(true);
    expect(decoded.showColourCode!.value).toBe(false);
    expect(decoded.showTimeSlot!.raw).toEqual([0x02]);
  });

  it('gives value undefined with raw and a label for values Studio does not offer', () => {
    const snap = snapshotFrom({});
    snap.main[0xaf] = 2;
    snap.main[0x06] = 2;
    snap.main[0xc1] = 1;
    snap.main[0x13] = 0xff;
    const decoded = decodeAtD890RadioSettings(snap, 'stock');
    expect(decoded.callDisplayMode).toMatchObject({ raw: [2] });
    expect(decoded.callDisplayMode!.value).toBeUndefined();
    expect(decoded.callDisplayMode!.label).toContain('Name based');
    expect(decoded.powerOnScreen!.value).toBeUndefined();
    expect(decoded.powerOnScreen!.label).toContain('Custom picture');
    expect(decoded.standbyBackground!.value).toBeUndefined();
    expect(decoded.keyShortP1).toEqual({ value: undefined, raw: [0xff] });
  });

  it('reports erased power-on text as not offered', () => {
    const snap = { main: new Uint8Array(0x200), ext: new Uint8Array(0x60).fill(0xff) };
    const decoded = decodeAtD890RadioSettings(snap, 'stock');
    expect(decoded.powerOnLine1!.value).toBeUndefined();
    expect(decoded.powerOnLine1!.raw).toHaveLength(0x20);
  });
});

describe('languageLockFromLocalInfo', () => {
  it.each([
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 0],
    [0xff, 0],
  ])('LocalInfo +0x04 = %i gives lock %i', (byte, lock) => {
    const info = new Uint8Array(0x100);
    info[0x04] = byte;
    expect(languageLockFromLocalInfo(info)).toBe(lock);
  });
});
