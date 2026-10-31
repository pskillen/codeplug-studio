/** Wording helpers for the RT95 Radio settings page (#1476). */

import { RT95_POWER_ON_PASSWORD_DIGITS } from '@core/radios/retevis/rt95/radioSettings.ts';
import {
  rt95SettingValueLabel,
  type Rt95SettingFieldDef,
} from '@core/radios/retevis/rt95/radioSettings.ts';
import type { Rt95DecodedSetting } from '@integrations/radio-io/radios/rt95/settingsCodec.ts';
import type { Rt95RadioSettingsRead } from '../services/radioIoRt95SettingsRead.ts';

export const KEEP_RADIO_VALUE_LABEL = "Keep radio's value";

export const SET_EMPTY_LINE_LABEL = '(empty line)';
export const SET_EMPTY_LINE_HINT = 'Will be set to an empty line.';

export function changesLabel(count: number): string {
  return `${count} ${count === 1 ? 'change' : 'changes'}`;
}

function timeLabel(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function readBannerText(read: Rt95RadioSettingsRead): string {
  return `Read at ${timeLabel(read.readAt)} · band limit code ${read.bandlimit}`;
}

export function radioValueText(
  field: Rt95SettingFieldDef,
  decoded: Rt95DecodedSetting | undefined,
  hasRead: boolean,
): string {
  if (!hasRead) return 'not read';
  if (!decoded) return 'not on this radio';
  const { value } = decoded;
  if (value === undefined) {
    if (decoded.label) return `${decoded.label} (not offered)`;
    const shown =
      field.kind === 'text' || field.kind === 'dtmfCode'
        ? 'unreadable text'
        : decoded.raw.join(' ');
    return `${shown} (not offered)`;
  }
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (typeof value === 'string') return value === '' ? '(empty)' : value;
  return rt95SettingValueLabel(field, value) ?? String(value);
}

const PASSWORD_DIGITS = new RegExp(`^[0-9]{${RT95_POWER_ON_PASSWORD_DIGITS}}$`);

export function rt95PowerOnPasswordProblem(digits: string, again: string): string | undefined {
  if (digits === '' && again === '') return undefined;
  if (!/^[0-9]*$/.test(digits)) return 'Digits 0–9 only.';
  if (digits.length !== RT95_POWER_ON_PASSWORD_DIGITS) {
    return `Exactly ${RT95_POWER_ON_PASSWORD_DIGITS} digits.`;
  }
  if (!PASSWORD_DIGITS.test(digits))
    return `Exactly ${RT95_POWER_ON_PASSWORD_DIGITS} digits (0–9).`;
  if (digits !== again) return 'The two entries do not match.';
  return undefined;
}
