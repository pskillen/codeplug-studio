/**
 * RT95 settings field allow-list and patch resolution (#1476).
 */

import {
  RT95_ALL_SETTINGS_FIELD_IDS,
  RT95_POWER_ON_PASSWORD_DIGITS,
  RT95_POWER_ON_PASSWORD_FIELD_IDS,
  RT95_STARTING_DISPLAY_MAX_LENGTH,
  rt95SettingField,
} from '@core/radios/retevis/rt95/radioSettings.ts';
import { isMm9pdyRt95RadioIoProfileId } from '@core/import-export/formats/radio-io/profiles.ts';
import type { RadioWriteOrganisation } from '../../radioWriteProjection.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import { RT95_BANDLIMIT_OFFSET, RT95_IMAGE_SIZE } from './constants.ts';

export type Rt95SettingsTarget = 'stock' | 'mm9pdy';
export type Rt95SettingValue = number | boolean | string;

export interface Rt95SettingsOverride {
  readonly fieldId: string;
  readonly value: Rt95SettingValue;
}

export interface Rt95SettingsFieldSpec {
  readonly id: string;
  readonly address: number;
  readonly length: number;
  readonly mask?: number;
  readonly targets: readonly Rt95SettingsTarget[];
  readonly advanced: boolean;
  /** Trust tag for tier-3 docs (`CPS` / `CHIRP` / `inferred`). */
  readonly trust: string;
  encode(value: Rt95SettingValue): Uint8Array;
  decode(bytes: Uint8Array): Rt95SettingValue | undefined;
}

export interface Rt95SettingsPatch {
  readonly fieldId: string;
  readonly address: number;
  readonly bytes: Uint8Array;
  readonly mask: Uint8Array;
}

export interface Rt95RadioSettingsSnapshot {
  /** Full clone image bytes (`0x32A0`). */
  readonly image: Uint8Array;
  readonly bandlimit: number;
}

const BOTH: readonly Rt95SettingsTarget[] = ['stock', 'mm9pdy'];
const IMAGE_END = RT95_IMAGE_SIZE;
const CHANNEL_END = 0x1940;
const BITFIELD_END = 0x1980;
/** Bits 6–7 of `0x321B` are never user settings (bit 7 is PC-write marker). */
const BYTE_321B_FORBIDDEN_MASK = 0xc0;

const DTMF_CHARSET = '0123456789ABCD*# ';
const INTERVAL_WIRE = [0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f] as const;
const GROUP_WIRE = [0xff, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f] as const;

function hex(n: number): string {
  return `0x${n.toString(16)}`;
}

function refuse(id: string, value: unknown, why: string): never {
  throw new RadioProtocolError(`RT95 setting ${id}: ${String(value)} is ${why}`);
}

function optionValues(id: string): ReadonlySet<number> {
  const def = rt95SettingField(id);
  if (!def?.options) throw new RadioProtocolError(`RT95 setting ${id} has no value list`);
  return new Set(def.options.map((o) => o.value));
}

export function assertRt95SettingsAddressPermitted(address: number, label: string): void {
  const where = `${label} covers ${hex(address)}`;
  if (address < 0 || address >= IMAGE_END) {
    throw new RadioProtocolError(`${where} (outside 0x0000–0x329F)`);
  }
  if (address < CHANNEL_END) {
    throw new RadioProtocolError(`${where} (channel records are never patched)`);
  }
  if (address >= 0x1940 && address < BITFIELD_END) {
    throw new RadioProtocolError(`${where} (channel bitfields are never patched)`);
  }
  if (address === RT95_BANDLIMIT_OFFSET) {
    throw new RadioProtocolError(`${where} (bandlimit is danger-zone class, not a setting)`);
  }
}

export function assertRt95SettingsSpecPermitted(spec: Rt95SettingsFieldSpec): void {
  if (!Number.isInteger(spec.length) || spec.length < 1) {
    throw new RadioProtocolError(`RT95 settings field ${spec.id} has no length`);
  }
  if (spec.mask !== undefined && spec.length !== 1) {
    throw new RadioProtocolError(`RT95 settings field ${spec.id}: mask requires a single byte`);
  }
  if (
    spec.address === 0x321b &&
    spec.mask !== undefined &&
    (spec.mask & BYTE_321B_FORBIDDEN_MASK) !== 0
  ) {
    throw new RadioProtocolError(
      `RT95 settings field ${spec.id}: mask touches forbidden bits of 0x321B`,
    );
  }
  for (let i = 0; i < spec.length; i++) {
    assertRt95SettingsAddressPermitted(spec.address + i, `RT95 settings field ${spec.id}`);
  }
}

export function assertRt95SettingsPatchPermitted(patch: Rt95SettingsPatch): void {
  const label = `RT95 settings patch ${patch.fieldId}`;
  if (patch.bytes.length < 1 || patch.mask.length !== patch.bytes.length) {
    throw new RadioProtocolError(`${label} needs bytes and mask of the same length`);
  }
  for (let i = 0; i < patch.bytes.length; i++) {
    assertRt95SettingsAddressPermitted(patch.address + i, label);
  }
}

export function assertRt95SettingsPatchesPermitted(patches: readonly Rt95SettingsPatch[]): void {
  for (const p of patches) assertRt95SettingsPatchPermitted(p);
}

function encodeDtmfString(id: string, value: Rt95SettingValue, length: number): Uint8Array {
  if (typeof value !== 'string') refuse(id, value, 'not text');
  if (value.length > length) refuse(id, value, `longer than ${length} characters`);
  const out = new Uint8Array(length).fill(0xff);
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]!;
    const idx = DTMF_CHARSET.indexOf(ch);
    if (idx < 0) refuse(id, value, 'not in the DTMF charset');
    out[i] = idx;
  }
  return out;
}

function decodeDtmfString(bytes: Uint8Array): string | undefined {
  let text = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    if (b === 0xff) break;
    if (b >= DTMF_CHARSET.length) return undefined;
    text += DTMF_CHARSET[b]!;
  }
  return text;
}

interface Layout {
  readonly id: string;
  readonly address: number;
  readonly mask?: number;
  readonly length?: number;
  readonly trust: string;
  readonly wireOffset?: (ui: number) => number;
  readonly uiFromWire?: (wire: number) => number | undefined;
}

function specFromLayout(layout: Layout): Rt95SettingsFieldSpec {
  const { id, address, mask, trust } = layout;
  const def = rt95SettingField(id);
  if (!def) throw new RadioProtocolError(`RT95 setting ${id} has no UI definition`);
  const length = layout.length ?? 1;
  const base = {
    id,
    address,
    length,
    targets: BOTH,
    advanced: def.advanced,
    trust,
  } as const;

  if (def.kind === 'password') {
    return {
      ...base,
      length: RT95_POWER_ON_PASSWORD_DIGITS,
      encode(value) {
        if (typeof value !== 'string') refuse(id, value, 'not text');
        if (value.length > RT95_POWER_ON_PASSWORD_DIGITS) {
          refuse(id, value, `longer than ${RT95_POWER_ON_PASSWORD_DIGITS} digits`);
        }
        const out = new Uint8Array(RT95_POWER_ON_PASSWORD_DIGITS);
        for (let i = 0; i < value.length; i++) {
          const c = value.charCodeAt(i);
          if (c < 0x30 || c > 0x39) refuse(id, value, 'not digits 0–9');
          out[i] = c;
        }
        return out;
      },
      decode(bytes) {
        let text = '';
        for (let i = 0; i < bytes.length; i++) {
          const b = bytes[i]!;
          if (b === 0) break;
          if (b < 0x30 || b > 0x39) return undefined;
          text += String.fromCharCode(b);
        }
        for (let i = text.length; i < bytes.length; i++) {
          if (bytes[i] !== 0) return undefined;
        }
        return text;
      },
    };
  }

  if (def.kind === 'text') {
    const max = def.maxLength ?? RT95_STARTING_DISPLAY_MAX_LENGTH;
    return {
      ...base,
      encode(value) {
        if (typeof value !== 'string') refuse(id, value, 'not text');
        if (value.length > max) refuse(id, value, `longer than ${max} characters`);
        const out = new Uint8Array(length);
        for (let i = 0; i < value.length; i++) {
          const c = value.charCodeAt(i);
          if (c < 0x20 || c > 0x7e) refuse(id, value, 'not printable ASCII');
          out[i] = c;
        }
        return out;
      },
      decode(bytes) {
        let text = '';
        for (let i = 0; i < bytes.length && i < max; i++) {
          const b = bytes[i]!;
          if (b === 0) break;
          if (b < 0x20 || b > 0x7e) return undefined;
          text += String.fromCharCode(b);
        }
        return text;
      },
    };
  }

  if (def.kind === 'dtmfCode') {
    const max = def.maxLength ?? 16;
    return {
      ...base,
      length: max,
      encode: (v) => encodeDtmfString(id, v, max),
      decode: (b) => decodeDtmfString(b),
    };
  }

  if (def.kind === 'boolean') {
    const on = mask ?? 1;
    return {
      ...base,
      ...(mask === undefined ? {} : { mask }),
      encode(value) {
        if (typeof value !== 'boolean') refuse(id, value, 'not on or off');
        return Uint8Array.of(value ? on : 0);
      },
      decode(bytes) {
        const b = bytes[0] ?? 0;
        if (mask !== undefined) return (b & mask) !== 0;
        return b !== 0;
      },
    };
  }

  const allowed = optionValues(id);
  return {
    ...base,
    ...(mask === undefined ? {} : { mask }),
    encode(value) {
      if (typeof value !== 'number' || !Number.isInteger(value) || !allowed.has(value)) {
        refuse(id, value, 'not an offered value');
      }
      const wire = layout.wireOffset ? layout.wireOffset(value) : value;
      return Uint8Array.of(wire);
    },
    decode(bytes) {
      const raw = mask !== undefined ? (bytes[0] ?? 0) & mask : (bytes[0] ?? 0);
      const ui = layout.uiFromWire ? layout.uiFromWire(raw) : raw;
      if (ui === undefined || !allowed.has(ui)) return undefined;
      return ui;
    },
  };
}

const LAYOUT: readonly Layout[] = [
  { id: 'startingDisplay', address: 0x1980, length: 7, trust: 'CPS+CHIRP' },
  ...Array.from({ length: 16 }, (_, i) => ({
    id: `pttIdM${i + 1}`,
    address: 0x1990 + i * 16,
    length: 16,
    trust: 'CHIRP',
  })),
  { id: 'pttIdStart', address: 0x1a90, length: 16, trust: 'CHIRP' },
  { id: 'pttIdEnd', address: 0x1aa0, length: 16, trust: 'CHIRP' },
  { id: 'remoteStun', address: 0x1ab0, length: 16, trust: 'CHIRP' },
  { id: 'remoteKill', address: 0x1ac0, length: 16, trust: 'CHIRP' },
  {
    id: 'dtmfIntervalChar',
    address: 0x1ad0,
    trust: 'CHIRP',
    wireOffset: (ui) => INTERVAL_WIRE[ui]!,
    uiFromWire: (w) => {
      const i = INTERVAL_WIRE.indexOf(w as (typeof INTERVAL_WIRE)[number]);
      return i >= 0 ? i : undefined;
    },
  },
  {
    id: 'dtmfGroupCode',
    address: 0x1ad1,
    trust: 'CHIRP',
    wireOffset: (ui) => GROUP_WIRE[ui]!,
    uiFromWire: (w) => {
      const i = GROUP_WIRE.indexOf(w as (typeof GROUP_WIRE)[number]);
      return i >= 0 ? i : undefined;
    },
  },
  { id: 'dtmfDecodingResponse', address: 0x1ad2, mask: 0x03, trust: 'CHIRP' },
  {
    id: 'dtmfPretime',
    address: 0x1ad3,
    trust: 'CHIRP',
    wireOffset: (ui) => ui + 1,
    uiFromWire: (w) => (w >= 1 && w <= 250 ? w - 1 : undefined),
  },
  {
    id: 'dtmfFirstDigitTime',
    address: 0x1ad4,
    trust: 'CHIRP',
    uiFromWire: (w) => (w <= 250 ? w : undefined),
  },
  { id: 'dtmfSelfId', address: 0x1ad6, length: 3, trust: 'CHIRP' },
  { id: 'dtmfSideTone', address: 0x1ad9, mask: 0x01, trust: 'CHIRP' },
  {
    id: 'dtmfTimeLapse',
    address: 0x1ada,
    trust: 'CHIRP',
    wireOffset: (ui) => ui + 1,
    uiFromWire: (w) => (w >= 1 && w <= 250 ? w - 1 : undefined),
  },
  { id: 'dtmfPttIdPause', address: 0x1adb, trust: 'CHIRP' },
  { id: 'beepVolume', address: 0x3200, mask: 0x07, trust: 'CPS+CHIRP' },
  { id: 'frequencyStep', address: 0x3201, mask: 0x0f, trust: 'CPS+CHIRP' },
  { id: 'displayMode', address: 0x3202, mask: 0x03, trust: 'CPS+CHIRP' },
  { id: 'squelchLevelA', address: 0x3204, mask: 0x0f, trust: 'CPS+CHIRP' },
  { id: 'squelchLevelB', address: 0x3205, mask: 0x0f, trust: 'CPS+CHIRP' },
  {
    id: 'speakerVolume',
    address: 0x3206,
    mask: 0x3f,
    trust: 'CPS+CHIRP',
    uiFromWire: (w) => (w >= 1 && w <= 36 ? w : undefined),
  },
  { id: 'powerOnPasswordEnabled', address: 0x3207, mask: 0x01, trust: 'CHIRP' },
  { id: 'scanType', address: 0x3208, mask: 0x03, trust: 'CPS+CHIRP' },
  { id: 'scanRecoveryTime', address: 0x3209, mask: 0x03, trust: 'CPS+CHIRP' },
  { id: 'autoPowerOn', address: 0x320a, mask: 0x01, trust: 'CPS+CHIRP' },
  { id: 'main', address: 0x320b, mask: 0x01, trust: 'CPS+CHIRP' },
  { id: 'rxWaySelect', address: 0x320c, mask: 0x01, trust: 'CPS+CHIRP' },
  {
    id: 'backlightBrightness',
    address: 0x320d,
    mask: 0x07,
    trust: 'CPS+CHIRP',
    uiFromWire: (w) => (w >= 1 && w <= 3 ? w : undefined),
  },
  { id: 'timeOutTimer', address: 0x320e, mask: 0x1f, trust: 'CPS+CHIRP' },
  { id: 'autoPowerOff', address: 0x320f, mask: 0x03, trust: 'CPS+CHIRP' },
  { id: 'tbstFrequency', address: 0x3210, mask: 0x03, trust: 'CPS+CHIRP' },
  { id: 'screenDirection', address: 0x3211, mask: 0x01, trust: 'CPS+CHIRP' },
  { id: 'speakerSwitch', address: 0x3213, mask: 0x03, trust: 'CPS+CHIRP' },
  { id: 'steType', address: 0x3218, mask: 0x07, trust: 'CPS+CHIRP' },
  { id: 'steFrequency', address: 0x3219, mask: 0x03, trust: 'CPS+CHIRP' },
  { id: 'dtmfTxTime', address: 0x321a, mask: 0x07, trust: 'CHIRP' },
  { id: 'knobMode', address: 0x321b, mask: 0x01, trust: 'CPS+CHIRP' },
  { id: 'trfEnable', address: 0x321b, mask: 0x02, trust: 'CPS+CHIRP' },
  { id: 'powerOnResetEnable', address: 0x321b, mask: 0x04, trust: 'CPS+CHIRP' },
  { id: 'saveChannelParameter', address: 0x321b, mask: 0x08, trust: 'CPS+CHIRP' },
  { id: 'channelLocked', address: 0x321b, mask: 0x10, trust: 'CPS+CHIRP' },
  { id: 'monKeyFunction', address: 0x321b, mask: 0x20, trust: 'CPS+CHIRP' },
  { id: 'voxOnOff', address: 0x321c, mask: 0x01, trust: 'CPS+CHIRP' },
  {
    id: 'voxLevel',
    address: 0x321d,
    trust: 'CPS+CHIRP',
    wireOffset: (ui) => ui - 1,
    uiFromWire: (w) => (w >= 0 && w <= 8 ? w + 1 : undefined),
  },
  { id: 'voxDelay', address: 0x321e, trust: 'CHIRP' },
  { id: 'powerOnPasswordDigits', address: 0x3240, trust: 'CPS+CHIRP' },
  ...PF_LAYOUT(),
];

function PF_LAYOUT(): Layout[] {
  const out: Layout[] = [];
  for (let i = 0; i < 12; i++) {
    out.push({
      id: `pfKeyMode${i < 6 ? 1 : 2}P${(i % 6) + 1}`,
      address: 0x3250 + i,
      trust: 'CPS+CHIRP',
      wireOffset: (ui) => ui + 1,
      uiFromWire: (w) => (w >= 1 && w <= 18 ? w - 1 : undefined),
    });
  }
  return out;
}

function buildRegistry(): ReadonlyMap<string, Rt95SettingsFieldSpec> {
  const map = new Map<string, Rt95SettingsFieldSpec>();
  for (const layout of LAYOUT) {
    const spec = specFromLayout(layout);
    assertRt95SettingsSpecPermitted(spec);
    if (map.has(spec.id)) {
      throw new RadioProtocolError(`RT95 settings field ${spec.id} is registered twice`);
    }
    map.set(spec.id, spec);
  }
  if ([...map.keys()].sort().join() !== [...RT95_ALL_SETTINGS_FIELD_IDS].sort().join()) {
    throw new RadioProtocolError('RT95 settings registry ids do not match the core field list');
  }
  return map;
}

export const RT95_SETTINGS_FIELDS: ReadonlyMap<string, Rt95SettingsFieldSpec> = buildRegistry();

/** Six valid ASCII digits already stored at `0x3240`, or `undefined`. */
export function rt95PasswordDigitsFromImage(image: Uint8Array): string | undefined {
  const spec = RT95_SETTINGS_FIELDS.get('powerOnPasswordDigits')!;
  const bytes = image.subarray(spec.address, spec.address + spec.length);
  const decoded = spec.decode(bytes);
  return typeof decoded === 'string' && decoded.length === RT95_POWER_ON_PASSWORD_DIGITS
    ? decoded
    : undefined;
}

export function assertRt95PowerOnPasswordPair(
  overrides: readonly Rt95SettingsOverride[],
  existingDigits?: string,
): void {
  const enabled = overrides.find((o) => o.fieldId === 'powerOnPasswordEnabled');
  const digits = overrides.find((o) => o.fieldId === 'powerOnPasswordDigits');
  if (!enabled && !digits) return;
  if (enabled?.value === true) {
    const fromPatch =
      typeof digits?.value === 'string' && digits.value.length === RT95_POWER_ON_PASSWORD_DIGITS;
    const fromRadio = existingDigits?.length === RT95_POWER_ON_PASSWORD_DIGITS;
    if (!fromPatch && !fromRadio) {
      throw new RadioProtocolError(
        'RT95 setting powerOnPassword: turning the password on needs six digits in the write or already on the radio',
      );
    }
  }
  if (enabled?.value === false && typeof digits?.value === 'string' && digits.value.length > 0) {
    throw new RadioProtocolError(
      'RT95 setting powerOnPassword: turning the password off clears the digits',
    );
  }
  if (digits && !enabled && typeof digits.value === 'string' && digits.value.length > 0) {
    if (digits.value.length !== RT95_POWER_ON_PASSWORD_DIGITS) {
      throw new RadioProtocolError(
        'RT95 setting powerOnPassword: the password must be exactly six digits',
      );
    }
  }
}

/**
 * When a PF-key override and the MM9PDY zone-key projection target the same byte, the explicit
 * PF-key override wins (zone key is not applied on the RT95 write branch today).
 */
export function resolveRt95SettingsPatches(
  overrides: readonly Rt95SettingsOverride[],
  target: Rt95SettingsTarget,
  opts?: { existingPasswordDigits?: string },
): Rt95SettingsPatch[] {
  assertRt95PowerOnPasswordPair(overrides, opts?.existingPasswordDigits);
  const seen = new Set<string>();
  const patches: Rt95SettingsPatch[] = [];
  const claimed = new Map<number, number>();
  for (const { fieldId, value } of overrides) {
    const spec = RT95_SETTINGS_FIELDS.get(fieldId);
    if (!spec) {
      throw new RadioProtocolError(`RT95 setting ${fieldId} is not a writable radio setting`);
    }
    if (!spec.targets.includes(target)) {
      throw new RadioProtocolError(
        `RT95 setting ${fieldId} is not available on the ${target} target`,
      );
    }
    if (seen.has(fieldId)) {
      throw new RadioProtocolError(`RT95 setting ${fieldId} is set twice`);
    }
    seen.add(fieldId);
    assertRt95SettingsSpecPermitted(spec);
    const bytes = spec.encode(value);
    if (bytes.length !== spec.length) {
      throw new RadioProtocolError(`RT95 setting ${fieldId} encoded ${bytes.length} bytes`);
    }
    const mask = new Uint8Array(spec.length).fill(0xff);
    if (spec.mask !== undefined) mask[0] = spec.mask;
    for (let i = 0; i < spec.length; i++) {
      const address = spec.address + i;
      const bits = claimed.get(address) ?? 0;
      if ((bits & mask[i]!) !== 0) {
        throw new RadioProtocolError(
          `RT95 settings ${fieldId} overlaps another setting at ${hex(address)}`,
        );
      }
      claimed.set(address, bits | mask[i]!);
    }
    patches.push({ fieldId, address: spec.address, bytes: bytes.slice(), mask });
  }
  assertRt95SettingsPatchesPermitted(patches);
  return patches;
}

export function rt95SettingsTargetForProfile(profileId: string): Rt95SettingsTarget {
  return isMm9pdyRt95RadioIoProfileId(profileId) ? 'mm9pdy' : 'stock';
}

export function rt95UploadSettingsFromOrganisation(
  organisation: RadioWriteOrganisation | undefined,
  profileId: string,
): readonly Rt95SettingsPatch[] {
  const overrides = organisation?.rt95SettingsOverrides;
  if (!overrides?.length) return [];
  return resolveRt95SettingsPatches(overrides, rt95SettingsTargetForProfile(profileId));
}

export { RT95_POWER_ON_PASSWORD_FIELD_IDS };
