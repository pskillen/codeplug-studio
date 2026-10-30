/**
 * RT95 settings snapshot decode (#1476).
 */

import { rt95SettingOptionLabel } from '@core/radios/retevis/rt95/radioSettings.ts';
import {
  RT95_SETTINGS_FIELDS,
  type Rt95RadioSettingsSnapshot,
  type Rt95SettingValue,
  type Rt95SettingsTarget,
} from './settingsFields.ts';
import { RT95_BANDLIMIT_OFFSET } from './constants.ts';

export interface Rt95DecodedSetting {
  readonly value?: Rt95SettingValue;
  readonly raw: number[];
  readonly label?: string;
}

export function decodeRt95RadioSettings(
  snapshot: Rt95RadioSettingsSnapshot,
  target: Rt95SettingsTarget,
): Record<string, Rt95DecodedSetting> {
  const out: Record<string, Rt95DecodedSetting> = {};
  const image = snapshot.image;
  for (const spec of RT95_SETTINGS_FIELDS.values()) {
    if (!spec.targets.includes(target)) continue;
    const bytes = image.subarray(spec.address, spec.address + spec.length);
    if (bytes.length < spec.length) continue;
    const value = spec.decode(bytes);
    const raw = [...bytes];
    const label =
      typeof value === 'number' && spec.length === 1 && spec.mask === undefined
        ? rt95SettingOptionLabel(spec.id, value)
        : undefined;
    out[spec.id] = label === undefined ? { value, raw } : { value, raw, label };
  }
  return out;
}

export function readRt95SettingsSnapshotFromImage(image: Uint8Array): Rt95RadioSettingsSnapshot {
  return {
    image,
    bandlimit: image[RT95_BANDLIMIT_OFFSET] ?? 0,
  };
}
