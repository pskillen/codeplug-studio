import { describe, expect, it } from 'vitest';
import {
  RT95_ADVANCED_SETTINGS_FIELD_IDS,
  RT95_ALL_SETTINGS_FIELD_IDS,
  RT95_PF_KEY_OPTIONS,
  RT95_SETTING_FIELDS,
  RT95_SETTING_SECTIONS,
  rt95SettingField,
  rt95SettingOptionLabel,
} from './radioSettings.ts';

describe('RT95 radio settings field model', () => {
  it('has unique ids matching the ordered list', () => {
    const ids = RT95_SETTING_FIELDS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...RT95_ALL_SETTINGS_FIELD_IDS].sort()).toEqual([...ids].sort());
  });

  it('orders sections for display', () => {
    const order = RT95_SETTING_SECTIONS.map((s) => s.id);
    const seen = RT95_ALL_SETTINGS_FIELD_IDS.map((id) =>
      order.indexOf(rt95SettingField(id)!.section),
    );
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it('offers eighteen PF key functions', () => {
    expect(RT95_PF_KEY_OPTIONS).toHaveLength(18);
    expect(RT95_PF_KEY_OPTIONS.map((o) => o.value)).toEqual(
      Array.from({ length: 18 }, (_, i) => i),
    );
  });

  it('labels enum options for beep volume', () => {
    expect(rt95SettingOptionLabel('beepVolume', 0)).toBe('Off');
    expect(rt95SettingOptionLabel('beepVolume', 3)).toBe('3');
  });

  it('marks advanced fields with warnings', () => {
    const advanced = RT95_SETTING_FIELDS.filter((f) => f.advanced);
    expect(advanced.map((f) => f.id).sort()).toEqual([...RT95_ADVANCED_SETTINGS_FIELD_IDS].sort());
    for (const f of advanced) expect(f.warning, f.id).toBeTruthy();
  });
});
