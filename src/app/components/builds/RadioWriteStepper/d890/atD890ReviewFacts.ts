/**
 * What the AT-D890UV Review step shows, as plain data (#1393): the radio's frequency range, the
 * channels it will only receive on, and the settings that would change. Pure; no React, no I/O.
 */

import {
  atD890MaintenanceUnlocked,
  describeAtD890FrequencyRange,
  listAtD890ReceiveOnlyChannels,
  type AtD890FrequencyRangeDescription,
} from '@core/radios/anytone/at-d890uv/frequencyRange.ts';
import {
  atD890SettingField,
  type AtD890SettingsTargetId,
} from '@core/radios/anytone/at-d890uv/radioSettings.ts';
import {
  decodeAtD890RadioSettings,
  type AtD890RadioSettingsSnapshot,
  type AtD890SettingsOverride,
  type AtD890SettingValue,
} from '@integrations/radio-io/radios/at-d890uv/index.ts';
import type { RadioChannelDto } from '@integrations/radio-io/radioChannelDto.ts';
import { radioValueText } from '../../../../lib/atD890RadioSettingsText.ts';

/**
 * The range the radio enforces, from the ident's band code. That code is the radio's own sanitised
 * value (a locked maintenance code 14 reads as 0), never the raw LocalInfo byte.
 */
export function atD890ReviewRange(
  snapshot: Pick<AtD890RadioSettingsSnapshot, 'bandCode' | 'localInfo'>,
): AtD890FrequencyRangeDescription {
  return describeAtD890FrequencyRange(snapshot.bandCode, {
    maintenanceUnlocked: atD890MaintenanceUnlocked(snapshot.localInfo),
  });
}

export interface AtD890ReceiveOnlyChannel {
  slotIndex: number;
  name: string;
  txMhz: number;
}

/** Channels the Write puts on the radio that its range will not let it transmit on. */
export function atD890ReceiveOnlyChannels(
  channels: readonly RadioChannelDto[],
  bandCode: number,
): AtD890ReceiveOnlyChannel[] {
  return listAtD890ReceiveOnlyChannels(channels, bandCode).map((c) => ({
    slotIndex: c.slotIndex,
    name: c.wireName,
    txMhz: c.txHz / 1e6,
  }));
}

export interface AtD890SettingChange {
  fieldId: string;
  label: string;
  /** What the radio holds now. */
  now: string;
  /** What it will hold after the Write. */
  after: string;
}

function afterText(value: AtD890SettingValue, fieldId: string, target: AtD890SettingsTargetId) {
  const field = atD890SettingField(fieldId);
  if (!field) return String(value);
  if (typeof value === 'string' && value === '') return '(empty line)';
  return radioValueText(field, target, { value, raw: [] }, true);
}

/**
 * The power-on password is one change in words: Off → On (with the digits the user chose, so they
 * can check them) or On → Off. The radio's own digits are never shown.
 */
function passwordChange(
  decoded: ReturnType<typeof decodeAtD890RadioSettings>,
  overrides: readonly AtD890SettingsOverride[],
): AtD890SettingChange | undefined {
  const enabled = overrides.find((o) => o.fieldId === 'powerOnPasswordEnabled')?.value === true;
  const digits = overrides.find((o) => o.fieldId === 'powerOnPasswordDigits')?.value;
  const nowOn = decoded.powerOnPasswordEnabled?.value;
  const nowDigits = decoded.powerOnPasswordDigits?.value;
  const unchanged = enabled
    ? nowOn === true && nowDigits === digits
    : nowOn === false && nowDigits === '';
  if (unchanged) return undefined;
  return {
    fieldId: 'powerOnPasswordEnabled',
    label: 'Power-on password',
    now: nowOn === undefined ? 'unknown' : nowOn ? 'On' : 'Off',
    after: enabled && typeof digits === 'string' ? `On (${digits})` : 'Off',
  };
}

/**
 * Overrides that would change this radio, in the order given. A field the radio already holds at
 * the chosen value is left out; so is a field that is not on this target.
 */
export function atD890SettingChanges(
  snapshot: Pick<AtD890RadioSettingsSnapshot, 'main' | 'ext'>,
  target: AtD890SettingsTargetId,
  overrides: readonly AtD890SettingsOverride[],
): AtD890SettingChange[] {
  const decoded = decodeAtD890RadioSettings(snapshot, target);
  const out: AtD890SettingChange[] = [];
  for (const o of overrides) {
    if (o.fieldId === 'powerOnPasswordDigits') continue; // reported with the on/off byte
    if (o.fieldId === 'powerOnPasswordEnabled') {
      const change = passwordChange(decoded, overrides);
      if (change) out.push(change);
      continue;
    }
    const field = atD890SettingField(o.fieldId);
    const current = decoded[o.fieldId];
    if (!field || !current) continue;
    if (current.value !== undefined && current.value === o.value) continue;
    out.push({
      fieldId: o.fieldId,
      label: field.label,
      now: radioValueText(field, target, current, true),
      after: afterText(o.value, o.fieldId, target),
    });
  }
  return out;
}

/** The first few overrides in words ("Volume bar On"), for the Radio settings part row. */
export function atD890OverrideWords(
  overrides: readonly AtD890SettingsOverride[],
  target: AtD890SettingsTargetId,
  max = 3,
): string[] {
  const words = overrides
    .filter((o) => o.fieldId !== 'powerOnPasswordDigits')
    .map((o) => {
      const field = atD890SettingField(o.fieldId);
      return field ? `${field.label} ${afterText(o.value, o.fieldId, target)}` : o.fieldId;
    });
  return words.length > max ? [...words.slice(0, max), `+${words.length - max} more`] : words;
}
