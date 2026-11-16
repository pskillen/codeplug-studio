/**
 * Read-only RT95 radio-settings inventory projected from a captured clone image.
 *
 * Every field registered for Write overrides (`settingsFields.ts`) is decoded from the clone
 * image and returned with its address, raw bytes, decoded value, trust tag and targets. Bytes
 * inside the two settings windows that no field claims are returned as unclaimed runs. A field is
 * shown only when every byte of its span was captured; nothing is gap-filled.
 */
import {
  RT95_SETTING_SECTIONS,
  rt95SettingField,
  rt95SettingValueLabel,
  type Rt95SettingSectionId,
} from '@core/radios/retevis/rt95/radioSettings.ts';
import { RT95_SETTINGS_FIELDS, type Rt95SettingsTarget } from './settingsFields.ts';

export const RT95_SETTINGS_GROUPS = RT95_SETTING_SECTIONS;

/** Windows of the clone image that carry settings: 0x1980-0x1AFF and 0x3200-0x327F (512 bytes). */
export const RT95_SETTINGS_WINDOWS: readonly { start: number; end: number }[] = [
  { start: 0x1980, end: 0x1b00 },
  { start: 0x3200, end: 0x3280 },
];

/** Ids whose raw bytes and value are a secret and stay masked until the operator reveals them. */
const SENSITIVE_FIELD_IDS: ReadonlySet<string> = new Set(['powerOnPasswordDigits']);

export interface Rt95SettingFieldView {
  id: string;
  label: string;
  help: string;
  group: Rt95SettingSectionId;
  address: number;
  length: number;
  mask?: number;
  advanced: boolean;
  trust: string;
  targets: readonly Rt95SettingsTarget[];
  status: 'captured' | 'not-captured';
  /** Decoded value text; `undefined` when the bytes are not interpreted. */
  value?: string;
  raw?: number[];
  /** True for the power-on password: hide `value` and `raw` until revealed. */
  sensitive: boolean;
}

export interface Rt95UnclaimedRun {
  address: number;
  raw?: number[];
  length: number;
}

export interface Rt95SettingsInventory {
  fields: Rt95SettingFieldView[];
  unclaimed: Rt95UnclaimedRun[];
  counts: {
    registered: number;
    captured: number;
    decoded: number;
    windowBytes: number;
    claimedBytes: number;
    unclaimedBytes: number;
  };
}

function valueText(id: string, value: number | boolean | string): string {
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (typeof value === 'number') {
    const def = rt95SettingField(id);
    return (def && rt95SettingValueLabel(def, value)) ?? String(value);
  }
  return value === '' ? '(empty)' : value;
}

export function projectRt95Settings(
  image: Uint8Array | undefined,
  base = 0,
): Rt95SettingsInventory {
  const at = (address: number, length: number) =>
    image && address >= base && address + length <= base + image.length
      ? image.subarray(address - base, address - base + length)
      : undefined;
  const fields: Rt95SettingFieldView[] = [];
  const claimed = new Set<number>();
  for (const spec of RT95_SETTINGS_FIELDS.values()) {
    for (let i = 0; i < spec.length; i++) claimed.add(spec.address + i);
    const def = rt95SettingField(spec.id);
    const bytes = at(spec.address, spec.length);
    const decoded = bytes ? spec.decode(bytes) : undefined;
    fields.push({
      id: spec.id,
      label: def?.label ?? spec.id,
      help: def?.help ?? '',
      group: def?.section ?? 'advanced',
      address: spec.address,
      length: spec.length,
      ...(spec.mask === undefined ? {} : { mask: spec.mask }),
      advanced: spec.advanced,
      trust: spec.trust,
      targets: spec.targets,
      status: bytes ? 'captured' : 'not-captured',
      ...(decoded === undefined ? {} : { value: valueText(spec.id, decoded) }),
      ...(bytes ? { raw: [...bytes] } : {}),
      sensitive: SENSITIVE_FIELD_IDS.has(spec.id),
    });
  }
  fields.sort((a, b) => a.address - b.address || (a.mask ?? 0) - (b.mask ?? 0));

  const unclaimed: Rt95UnclaimedRun[] = [];
  let windowBytes = 0;
  let claimedBytes = 0;
  for (const { start, end } of RT95_SETTINGS_WINDOWS) {
    windowBytes += end - start;
    let runStart = -1;
    for (let a = start; a <= end; a++) {
      const free = a < end && !claimed.has(a);
      if (a < end && !free) claimedBytes++;
      if (free && runStart < 0) runStart = a;
      if (!free && runStart >= 0) {
        const raw = at(runStart, a - runStart);
        unclaimed.push({
          address: runStart,
          length: a - runStart,
          ...(raw ? { raw: [...raw] } : {}),
        });
        runStart = -1;
      }
    }
  }
  return {
    fields,
    unclaimed,
    counts: {
      registered: fields.length,
      captured: fields.filter((f) => f.status === 'captured').length,
      decoded: fields.filter((f) => f.value !== undefined).length,
      windowBytes,
      claimedBytes,
      unclaimedBytes: windowBytes - claimedBytes,
    },
  };
}
