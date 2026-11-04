/**
 * Values to exercise every field of the RT95 settings registry (#1465). Tests only.
 *
 * Derived from the field definitions (every enum option, both booleans, empty and full-length
 * text and DTMF strings), not from any radio. The power-on password pair has its own rules and is
 * covered separately.
 */

import {
  RT95_SETTING_FIELDS,
  RT95_STARTING_DISPLAY_MAX_LENGTH,
  type Rt95SettingFieldDef,
} from '@core/radios/retevis/rt95/radioSettings.ts';
import type { Rt95SettingValue, Rt95SettingsOverride } from '../settingsFields.ts';

const DTMF_FULL = '0123456789ABCD*#';

/** Fields with their own pairing rules (enable flag plus six digits). */
export const RT95_PASSWORD_FIELD_IDS: readonly string[] = [
  'powerOnPasswordEnabled',
  'powerOnPasswordDigits',
];

/** Every value worth writing for a field: all options, both booleans, empty and full text. */
export function rt95FixtureValues(def: Rt95SettingFieldDef): Rt95SettingValue[] {
  switch (def.kind) {
    case 'enum':
      return def.options!.map((o) => o.value);
    case 'boolean':
      return [false, true];
    case 'text':
      return ['', 'MM9PDY-'.slice(0, def.maxLength ?? RT95_STARTING_DISPLAY_MAX_LENGTH)];
    case 'dtmfCode':
      return ['', DTMF_FULL.slice(0, def.maxLength ?? 16)];
    case 'password':
      return [];
  }
}

/** Fields that take part in the one-value-each sweeps. */
export const RT95_SWEEP_FIELDS: readonly Rt95SettingFieldDef[] = RT95_SETTING_FIELDS.filter(
  (f) => !RT95_PASSWORD_FIELD_IDS.includes(f.id),
);

/** One override per swept field, taking the value at `pick` of its list (clamped to the last). */
export function rt95OverridesAt(pick: 'first' | 'last'): Rt95SettingsOverride[] {
  return RT95_SWEEP_FIELDS.map((def) => {
    const values = rt95FixtureValues(def);
    return { fieldId: def.id, value: pick === 'first' ? values[0]! : values[values.length - 1]! };
  });
}
