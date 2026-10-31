/**
 * RT95 Review facts (#1476): settings now → after, and override words for the Write stepper.
 */

import {
  rt95SettingField,
  rt95SettingValueLabel,
  type Rt95SettingFieldDef,
} from '@core/radios/retevis/rt95/radioSettings.ts';
import { decodeRt95RadioSettings } from '@integrations/radio-io/radios/rt95/settingsCodec.ts';
import type {
  Rt95RadioSettingsSnapshot,
  Rt95SettingsOverride,
  Rt95SettingsTarget,
} from '@integrations/radio-io/radios/rt95/settingsFields.ts';
import { radioValueText } from '../../../../lib/rt95RadioSettingsText.ts';

export interface Rt95SettingChange {
  fieldId: string;
  label: string;
  now: string;
  after: string;
  advanced: boolean;
}

function afterText(value: unknown, field: Rt95SettingFieldDef): string {
  if (typeof value === 'string' && value === '') return '(empty)';
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (typeof value === 'number') {
    return rt95SettingValueLabel(field, value) ?? String(value);
  }
  return String(value);
}

function passwordChange(
  decoded: ReturnType<typeof decodeRt95RadioSettings>,
  overrides: readonly Rt95SettingsOverride[],
): Rt95SettingChange | undefined {
  const enabled = overrides.find((o) => o.fieldId === 'powerOnPasswordEnabled')?.value === true;
  const digits = overrides.find((o) => o.fieldId === 'powerOnPasswordDigits')?.value;
  const nowOn = decoded.powerOnPasswordEnabled?.value;
  const nowDigits = decoded.powerOnPasswordDigits?.value;
  const unchanged = enabled
    ? nowOn === true && nowDigits === digits
    : nowOn === false && (nowDigits === '' || nowDigits === undefined);
  if (unchanged) return undefined;
  return {
    fieldId: 'powerOnPasswordEnabled',
    label: 'Power-on password',
    now: nowOn === undefined ? 'unknown' : nowOn ? 'On' : 'Off',
    after:
      enabled && typeof digits === 'string'
        ? `On (${digits})`
        : nowOn === false
          ? 'Off (stored digits cleared)'
          : 'Off',
    advanced: true,
  };
}

export function rt95SettingChanges(
  snapshot: Rt95RadioSettingsSnapshot,
  target: Rt95SettingsTarget,
  overrides: readonly Rt95SettingsOverride[],
): Rt95SettingChange[] {
  const decoded = decodeRt95RadioSettings(snapshot, target);
  const out: Rt95SettingChange[] = [];
  for (const o of overrides) {
    if (o.fieldId === 'powerOnPasswordDigits') continue;
    if (o.fieldId === 'powerOnPasswordEnabled') {
      const change = passwordChange(decoded, overrides);
      if (change) out.push(change);
      continue;
    }
    const field = rt95SettingField(o.fieldId);
    const current = decoded[o.fieldId];
    if (!field || !current) continue;
    if (current.value !== undefined && current.value === o.value) continue;
    out.push({
      fieldId: o.fieldId,
      label: field.label,
      now: radioValueText(field, current, true),
      after: afterText(o.value, field),
      advanced: field.advanced,
    });
  }
  return out;
}

export function rt95OverrideWords(
  overrides: readonly Rt95SettingsOverride[],
  _target: Rt95SettingsTarget,
  max = 3,
): string[] {
  const words = overrides
    .filter((o) => o.fieldId !== 'powerOnPasswordDigits')
    .map((o) => {
      const field = rt95SettingField(o.fieldId);
      return field ? `${field.label} ${afterText(o.value, field)}` : o.fieldId;
    });
  return words.length > max ? [...words.slice(0, max), `+${words.length - max} more`] : words;
}
