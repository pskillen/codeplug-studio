/**
 * AT-D890UV radio settings: decode a settings snapshot into typed field values (#1393).
 *
 * Pure: the snapshot comes from `AtD890uvProtocol.readSettingsSnapshot()`. A value the radio holds
 * that Studio does not offer (a custom start-up picture, `+0xAF` = 2, a corrupt byte) decodes to
 * `value: undefined`; `raw` always has the bytes read, and `label` names the value when the field
 * knows it (offered or read-only), so the page can show what the radio has.
 */

import { atD890SettingOptionLabel } from '@core/radios/anytone/at-d890uv/radioSettings.ts';
import {
  AT_D890_SETTINGS_FIELDS,
  type AtD890RadioSettingsSnapshot,
  type AtD890SettingValue,
  type AtD890SettingsTarget,
} from './settingsFields.ts';
import { D890_MAP } from './constants.ts';

export interface AtD890DecodedSetting {
  /** `undefined` when the radio holds a value Studio does not offer. */
  readonly value?: AtD890SettingValue;
  /** The bytes read for this field (the whole byte for a masked field). */
  readonly raw: number[];
  /** Name of an enum value the field knows, including read-only ones. */
  readonly label?: string;
}

/** Language lock from LocalInfo `+0x04`: 0 free, 1 English forced, 2 Chinese forced. */
export type AtD890LanguageLock = 0 | 1 | 2;

export function languageLockFromLocalInfo(localInfo: Uint8Array): AtD890LanguageLock {
  const b = localInfo[0x04];
  return b === 1 || b === 2 ? b : 0;
}

/**
 * Every registered field of the snapshot, by field id. Fields the target does not have are left out.
 */
export function decodeAtD890RadioSettings(
  snapshot: Pick<AtD890RadioSettingsSnapshot, 'main' | 'ext'>,
  target: AtD890SettingsTarget,
): Record<string, AtD890DecodedSetting> {
  const out: Record<string, AtD890DecodedSetting> = {};
  for (const spec of AT_D890_SETTINGS_FIELDS.values()) {
    if (!spec.targets.includes(target)) continue;
    const inMain =
      spec.address >= D890_MAP.OptionalSettingsMain &&
      spec.address < D890_MAP.OptionalSettingsMain + 0x200;
    const block = inMain ? snapshot.main : snapshot.ext;
    const start =
      spec.address - (inMain ? D890_MAP.OptionalSettingsMain : D890_MAP.OptionalSettingsExt);
    const bytes = block.subarray(start, start + spec.length);
    if (bytes.length < spec.length) continue;
    const value = spec.decode(bytes);
    const raw = [...bytes];
    const label =
      typeof raw[0] === 'number' && spec.length === 1 && spec.mask === undefined
        ? atD890SettingOptionLabel(spec.id, raw[0])
        : undefined;
    out[spec.id] = label === undefined ? { value, raw } : { value, raw, label };
  }
  return out;
}
