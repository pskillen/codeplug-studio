import { describe, expect, it } from 'vitest';
import {
  AT_D890_KEY_FUNCTIONS,
  AT_D890_SETTING_FIELDS,
  AT_D890_SETTING_SECTIONS,
  AT_D890_V1_SETTINGS_FIELD_IDS,
  atD890KeyFunctionOptions,
  atD890SettingField,
  atD890SettingOptionLabel,
} from './radioSettings.ts';

describe('AT-D890 radio settings field model', () => {
  it('has unique ids and lists every field in the display order', () => {
    const ids = AT_D890_SETTING_FIELDS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...AT_D890_V1_SETTINGS_FIELD_IDS].sort()).toEqual([...ids].sort());
  });

  it('orders ids by section order', () => {
    const order = AT_D890_SETTING_SECTIONS.map((s) => s.id);
    const seen = AT_D890_V1_SETTINGS_FIELD_IDS.map((id) =>
      order.indexOf(atD890SettingField(id)!.section),
    );
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(order).toEqual([
      'callDisplay',
      'startup',
      'volumeAudio',
      'tones',
      'display',
      'keys',
      'powerTimers',
      'dmr',
    ]);
  });

  it('gives every enum and level at least two options with unique values', () => {
    for (const f of AT_D890_SETTING_FIELDS) {
      if (f.kind === 'enum' || f.kind === 'level') {
        const values = (f.options ?? []).map((o) => o.value);
        // Standby background offers only the default picture; custom pictures are read-only.
        const min = f.id === 'standbyBackground' ? 1 : 2;
        expect(values.length, f.id).toBeGreaterThanOrEqual(min);
        expect(new Set(values).size, f.id).toBe(values.length);
        const readOnly = (f.readOnlyOptions ?? []).map((o) => o.value);
        for (const v of readOnly) expect(values, f.id).not.toContain(v);
      } else {
        expect(f.options, f.id).toBeUndefined();
      }
    }
  });

  it('has 65 key functions numbered 0..64', () => {
    expect(AT_D890_KEY_FUNCTIONS.map((k) => k.value)).toEqual(
      Array.from({ length: 65 }, (_, i) => i),
    );
  });

  it('renames four key functions on MM9PDY and keeps every wire value', () => {
    const stock = atD890KeyFunctionOptions('stock');
    const mm = atD890KeyFunctionOptions('mm9pdy');
    expect(mm.map((o) => o.value)).toEqual(stock.map((o) => o.value));
    const changed = mm.filter((o, i) => o.label !== stock[i]!.label).map((o) => o.value);
    expect(changed).toEqual([13, 14, 30, 55]);
    expect(mm[13]!.label).toBe('TG Previous');
    expect(mm[14]!.label).toBe('TG Next');
  });

  it('labels offered and read-only values', () => {
    expect(atD890SettingOptionLabel('callSignColour', 7)).toBe('Black');
    expect(atD890SettingOptionLabel('callDisplayMode', 2)).toContain('Name based');
    expect(atD890SettingOptionLabel('callDisplayMode', 9)).toBeUndefined();
  });

  it('keeps the time-zone list at 34 entries', () => {
    expect(atD890SettingField('timeZone')!.options).toHaveLength(34);
  });
});
