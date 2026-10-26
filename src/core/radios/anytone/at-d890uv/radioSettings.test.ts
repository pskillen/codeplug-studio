import { describe, expect, it } from 'vitest';
import {
  AT_D890_KEY_FUNCTIONS,
  AT_D890_SETTING_FIELDS,
  AT_D890_SETTING_SECTIONS,
  AT_D890_ADVANCED_SETTINGS_FIELD_IDS,
  AT_D890_ALL_SETTINGS_FIELD_IDS,
  AT_D890_V1_SETTINGS_FIELD_IDS,
  atD890KeyFunctionOptions,
  atD890LanguagesForLock,
  atD890SettingField,
  atD890SettingExposureFor,
  atD890SettingOptionLabel,
  atD890SettingOptionsFor,
  atD890SettingValueLabelFor,
  atD890TextProblem,
} from './radioSettings.ts';

describe('AT-D890 radio settings field model', () => {
  it('has unique ids and lists every field in the display order', () => {
    const ids = AT_D890_SETTING_FIELDS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...AT_D890_ALL_SETTINGS_FIELD_IDS].sort()).toEqual([...ids].sort());
  });

  it('orders ids by section order', () => {
    const order = AT_D890_SETTING_SECTIONS.map((s) => s.id);
    const seen = AT_D890_ALL_SETTINGS_FIELD_IDS.map((id) =>
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
      'advanced',
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

describe('AT-D890 radio settings page helpers', () => {
  it('uses MM9PDY key names only on the MM9PDY target', () => {
    const f = atD890SettingField('keyShortP1')!;
    expect(atD890SettingValueLabelFor(f, 14, 'stock')).toBe('Record');
    expect(atD890SettingValueLabelFor(f, 14, 'mm9pdy')).toBe('TG Next');
    expect(atD890SettingValueLabelFor(f, 13, 'mm9pdy')).toBe('TG Previous');
    expect(atD890SettingOptionsFor(f, 'mm9pdy')).toHaveLength(65);
  });

  it('labels read-only values and tags exposure per target', () => {
    const f = atD890SettingField('callDisplayMode')!;
    expect(atD890SettingValueLabelFor(f, 2, 'stock')).toMatch(/Name based/);
    for (const field of AT_D890_SETTING_FIELDS) {
      expect(['menu', 'cps', 'hidden']).toContain(atD890SettingExposureFor(field, 'mm9pdy'));
    }
  });

  it('accepts printable ASCII up to the line length and refuses the rest', () => {
    const line = atD890SettingField('powerOnLine1')!;
    expect(atD890TextProblem(line, '')).toBeUndefined();
    expect(atD890TextProblem(line, 'MM9PDY D890')).toBeUndefined();
    expect(atD890TextProblem(line, 'x'.repeat(line.maxLength!))).toBeUndefined();
    expect(atD890TextProblem(line, 'x'.repeat(line.maxLength! + 1))).toBeDefined();
    expect(atD890TextProblem(line, 'café')).toBeDefined();
    expect(atD890TextProblem(line, 'tab\t')).toBeDefined();
  });
});

describe('AT-D890 advanced fields', () => {
  it('flags exactly the advanced section, each with a warning, and keeps v1 free of them', () => {
    const advanced = AT_D890_SETTING_FIELDS.filter((f) => f.advanced);
    expect(advanced.map((f) => f.id)).toEqual([...AT_D890_ADVANCED_SETTINGS_FIELD_IDS]);
    for (const f of advanced) {
      expect(f.section, f.id).toBe('advanced');
      expect(f.warning, f.id).toBeTruthy();
    }
    for (const id of AT_D890_V1_SETTINGS_FIELD_IDS) {
      expect(atD890SettingField(id)!.advanced, id).toBe(false);
    }
  });

  it('offers language by the radio region lock', () => {
    expect(atD890LanguagesForLock(0).map((o) => o.label)).toEqual([
      'English',
      'Chinese',
      'Russian',
    ]);
    expect(atD890LanguagesForLock(1).map((o) => o.label)).toEqual(['English']);
    expect(atD890LanguagesForLock(2).map((o) => o.label)).toEqual(['Chinese']);
  });
});
