/** Wording helpers for the AT-D890UV Radio settings page (#1393). */

import {
  atD890SettingValueLabelFor,
  type AtD890SettingFieldDef,
  type AtD890SettingsTargetId,
} from '@core/radios/anytone/at-d890uv/radioSettings.ts';
import type { AtD890DecodedSetting } from '@integrations/radio-io/radios/at-d890uv/index.ts';
import type { AtD890RadioSettingsRead } from '../state/atD890RadioSettingsSession.ts';

export const KEEP_RADIO_VALUE_LABEL = "Keep radio's value";

/** Shown in a text row that is set to an empty line, so it does not read as "keep". */
export const SET_EMPTY_LINE_LABEL = '(empty line)';
export const SET_EMPTY_LINE_HINT = 'Will be set to an empty line.';

export const WRITE_ARRIVES_LATER_NOTE =
  'Writing these settings arrives with the next Write update.';

export function changesLabel(count: number): string {
  return `${count} ${count === 1 ? 'change' : 'changes'}`;
}

/** hh:mm in the user's locale. */
function timeLabel(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * The frequency range caption for the band code from the read.
 * TODO(#1393 PR 7): use describeAtD890FrequencyRange(code) once PR 7 (#1395) is on this stack;
 * whichever of PR 3 / PR 7 merges second completes this line.
 */
export function rangeCaption(bandCode: number): string {
  return `code ${bandCode}`;
}

/** Banner text for a settings read. The serial is shown in full (it is not sensitive). */
export function readBannerText(read: AtD890RadioSettingsRead): string {
  const name = read.masterIdName.trim() || 'the radio';
  return `Read from ${name} (${read.serial}) at ${timeLabel(read.readAt)} · range ${rangeCaption(read.bandCode)}`;
}

/** The Radio column text. */
export function radioValueText(
  field: AtD890SettingFieldDef,
  target: AtD890SettingsTargetId,
  decoded: AtD890DecodedSetting | undefined,
  hasRead: boolean,
): string {
  if (!hasRead) return 'not read';
  if (!decoded) return 'not on this radio';
  const { value } = decoded;
  if (value === undefined) {
    if (decoded.label) return `${decoded.label} (not offered)`;
    const shown = field.kind === 'text' ? 'unreadable text' : decoded.raw.join(' ');
    return `${shown} (not offered)`;
  }
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (typeof value === 'string') return value === '' ? '(empty)' : value;
  return atD890SettingValueLabelFor(field, value, target) ?? String(value);
}
