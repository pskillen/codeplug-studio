/**
 * AT-D890UV radio settings: the field allow-list for settings patches (#1393).
 *
 * A settings override is a typed value for one registered field. Upload turns each override into a
 * field patch (address, new bytes, bit mask) applied to the **fresh read** of erase unit
 * `0x3500000`. Nothing here replays a stored settings image, and a field that is not in
 * {@link AT_D890_SETTINGS_FIELDS} cannot be written. The registry is checked at module load
 * against the permitted spans and the never-patch offsets, and again by the unit tests.
 *
 * Wire facts: `docs/reference/radios/anytone/at-d890uv/memory-layout.md`.
 */

import {
  AT_D890_POWER_ON_LINE_MAX_LENGTH,
  atD890SettingField,
} from '@core/radios/anytone/at-d890uv/radioSettings.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import { AT_D890_SAFE_SKIP_WRITE_ADDR, D890_MAP } from './constants.ts';
import { isAtD890EraseUnitBookkeepingAddress } from './eraseUnits.ts';

export type AtD890SettingsTarget = 'stock' | 'mm9pdy';
export type AtD890SettingValue = number | boolean | string;

export interface AtD890SettingsOverride {
  readonly fieldId: string;
  readonly value: AtD890SettingValue;
}

export interface AtD890SettingsFieldSpec {
  readonly id: string;
  /** Absolute address of the first byte, e.g. `0x3500013`. */
  readonly address: number;
  /** Bytes covered. */
  readonly length: number;
  /** Single-byte fields only: the bits this field owns. Default `0xff`. */
  readonly mask?: number;
  readonly targets: readonly AtD890SettingsTarget[];
  readonly advanced: boolean;
  /** Typed value to wire bytes; throws {@link RadioProtocolError} when the value is not valid. */
  encode(value: AtD890SettingValue): Uint8Array;
  /** Wire bytes to typed value, or `undefined` when the radio holds a value we do not offer. */
  decode(bytes: Uint8Array): AtD890SettingValue | undefined;
}

export interface AtD890SettingsPatch {
  readonly fieldId: string;
  readonly address: number;
  /** New values. Only the bits set in {@link mask} are applied. */
  readonly bytes: Uint8Array;
  /** Per byte: the bits this patch may change. */
  readonly mask: Uint8Array;
}

/** What a cheap settings read returns: just the spans the confirm and the settings page need. */
export interface AtD890RadioSettingsSnapshot {
  /** LocalInfo, `0x100` bytes (serial, band code). */
  readonly localInfo: Uint8Array;
  /** Optional settings main record, `0x200` bytes. */
  readonly main: Uint8Array;
  /** Power-on lines and password block, `0x60` bytes. */
  readonly ext: Uint8Array;
  /** Master radio ID record, `0x40` bytes. */
  readonly masterId: Uint8Array;
  /** Band code from the connection ident (byte 8). */
  readonly bandCode: number;
}

/** Inclusive-start, exclusive-end span a spec may cover. */
interface PermittedSpan {
  readonly start: number;
  readonly end: number;
}

const MAIN = D890_MAP.OptionalSettingsMain;
const EXT = D890_MAP.OptionalSettingsExt;

/** Optional-settings main record, `+0x000..+0x15F`. */
export const AT_D890_SETTINGS_MAIN_SPAN: PermittedSpan = { start: MAIN, end: MAIN + 0x160 };
/** Power-on lines and password, `+0x900..+0x947`. */
export const AT_D890_SETTINGS_EXT_SPAN: PermittedSpan = { start: EXT, end: EXT + 0x48 };

const PERMITTED_SPANS: readonly PermittedSpan[] = [
  AT_D890_SETTINGS_MAIN_SPAN,
  AT_D890_SETTINGS_EXT_SPAN,
];

/**
 * Offsets inside the main record that hold radio state, never settings. Refused even when a spec
 * lists them (10-re-settings-fields §5).
 */
export const AT_D890_NEVER_PATCH_MAIN_OFFSETS: readonly number[] = [
  0x15, 0x16, 0x1d, 0x1e, 0x1f, 0x20, 0x21, 0x2c, 0x4e, 0x6f, 0x70, 0xdb, 0x13e, 0x13f, 0x140,
  0x14e, 0x14f, 0x150,
];

const NEVER_PATCH_ADDRESSES: ReadonlySet<number> = new Set(
  AT_D890_NEVER_PATCH_MAIN_OFFSETS.map((off) => MAIN + off),
);

function hex(address: number): string {
  return `0x${address.toString(16)}`;
}

function inPermittedSpan(address: number): boolean {
  return PERMITTED_SPANS.some((s) => address >= s.start && address < s.end);
}

/** Throws unless the byte at `address` may be patched; `label` names the spec or patch. */
function assertAtD890SettingsAddressPermitted(address: number, label: string): void {
  const where = `${label} covers ${hex(address)}`;
  if (address >= D890_MAP.LocalInfo && address < D890_MAP.LocalInfo + D890_MAP.LocalInfoLength) {
    throw new RadioProtocolError(`${where} (LocalInfo is never written)`);
  }
  if (
    (address >= D890_MAP.AlarmBitmap && address < D890_MAP.AlarmBitmap + 0x10) ||
    (address >= D890_MAP.AlarmData && address < D890_MAP.AlarmData + 0x30)
  ) {
    throw new RadioProtocolError(`${where} (alarm settings are never written)`);
  }
  if (
    address >= D890_MAP.ZoneAChannel &&
    address < D890_MAP.ZoneBChannel + D890_MAP.ZoneTableBytes
  ) {
    throw new RadioProtocolError(`${where} (Zone A/B tables belong to the codeplug Write)`);
  }
  if (address === AT_D890_SAFE_SKIP_WRITE_ADDR) {
    throw new RadioProtocolError(`${where} (family safe-skip address)`);
  }
  if (isAtD890EraseUnitBookkeepingAddress(address & ~0xf)) {
    throw new RadioProtocolError(`${where} (erase-unit flash marker)`);
  }
  if (NEVER_PATCH_ADDRESSES.has(address)) {
    throw new RadioProtocolError(`${where} (radio state, never patched)`);
  }
  if (!inPermittedSpan(address)) {
    throw new RadioProtocolError(`${where} (outside the permitted settings spans)`);
  }
}

/** Refuses a spec that covers any byte outside the permitted spans or on a never-patch offset. */
export function assertAtD890SettingsSpecPermitted(spec: AtD890SettingsFieldSpec): void {
  if (!Number.isInteger(spec.length) || spec.length < 1) {
    throw new RadioProtocolError(`D890 settings field ${spec.id} has no length`);
  }
  if (spec.mask !== undefined && spec.length !== 1) {
    throw new RadioProtocolError(
      `D890 settings field ${spec.id}: a mask needs a single-byte field`,
    );
  }
  for (let i = 0; i < spec.length; i++) {
    assertAtD890SettingsAddressPermitted(spec.address + i, `D890 settings field ${spec.id}`);
  }
}

/**
 * Transmit-layer allow-list: refuses a raw patch that covers any byte outside the permitted spans
 * or on a never-patch offset, or whose bytes and mask disagree. Called by the protocol before any
 * frame, so a patch built by hand cannot bypass {@link resolveAtD890SettingsPatches}.
 */
export function assertAtD890SettingsPatchPermitted(patch: AtD890SettingsPatch): void {
  const label = `D890 settings patch ${patch.fieldId}`;
  if (!Number.isInteger(patch.address) || patch.address < 0) {
    throw new RadioProtocolError(`${label} has an invalid address`);
  }
  if (patch.bytes.length < 1 || patch.mask.length !== patch.bytes.length) {
    throw new RadioProtocolError(`${label} needs bytes and a mask of the same length`);
  }
  for (let i = 0; i < patch.bytes.length; i++) {
    assertAtD890SettingsAddressPermitted(patch.address + i, label);
  }
}

export function assertAtD890SettingsPatchesPermitted(
  patches: readonly AtD890SettingsPatch[],
): void {
  for (const patch of patches) assertAtD890SettingsPatchPermitted(patch);
}

const BOTH_TARGETS: readonly AtD890SettingsTarget[] = ['stock', 'mm9pdy'];

function refuse(id: string, value: unknown, why: string): never {
  throw new RadioProtocolError(`D890 setting ${id}: ${String(value)} is ${why}`);
}

function optionValues(id: string): ReadonlySet<number> {
  const def = atD890SettingField(id);
  if (!def?.options) throw new RadioProtocolError(`D890 setting ${id} has no value list`);
  return new Set(def.options.map((o) => o.value));
}

/** Where a field lives. `offset` is from the main record, or from the ext block when `ext`. */
interface FieldLayout {
  readonly id: string;
  readonly offset: number;
  readonly mask?: number;
  readonly ext?: boolean;
  /** Boolean decode: any non-zero byte is on (the firmware tests `!= 0`). */
  readonly anyNonZeroOn?: boolean;
}

/** Power-on text: UTF-16LE, NUL padded to this many bytes. */
export const AT_D890_POWER_ON_LINE_BYTES = 0x20;

function isPrintableAscii(code: number): boolean {
  return code >= 0x20 && code <= 0x7e;
}

function specFor(layout: FieldLayout): AtD890SettingsFieldSpec {
  const { id, mask, anyNonZeroOn } = layout;
  const def = atD890SettingField(id);
  if (!def) throw new RadioProtocolError(`D890 setting ${id} has no field definition`);
  const address = (layout.ext ? EXT : MAIN) + layout.offset;
  const base = { id, address, targets: BOTH_TARGETS, advanced: false } as const;

  if (def.kind === 'text') {
    const maxLength = def.maxLength ?? AT_D890_POWER_ON_LINE_MAX_LENGTH;
    return {
      ...base,
      length: AT_D890_POWER_ON_LINE_BYTES,
      encode(value) {
        if (typeof value !== 'string') refuse(id, value, 'not text');
        if (value.length > maxLength) refuse(id, value, `longer than ${maxLength} characters`);
        const out = new Uint8Array(AT_D890_POWER_ON_LINE_BYTES);
        for (let i = 0; i < value.length; i++) {
          const code = value.charCodeAt(i);
          if (!isPrintableAscii(code)) refuse(id, value, 'not printable ASCII');
          out[i * 2] = code;
        }
        return out;
      },
      decode(bytes) {
        let text = '';
        for (let i = 0; i + 1 < bytes.length && i < maxLength * 2; i += 2) {
          const code = bytes[i]! | (bytes[i + 1]! << 8);
          if (code === 0) break;
          if (!isPrintableAscii(code)) return undefined;
          text += String.fromCharCode(code);
        }
        return text;
      },
    };
  }

  if (def.kind === 'boolean') {
    const bits = mask ?? 0xff;
    const on = mask === undefined ? 1 : mask;
    return {
      ...base,
      length: 1,
      ...(mask === undefined ? {} : { mask }),
      encode(value) {
        if (typeof value !== 'boolean') refuse(id, value, 'not on or off');
        return Uint8Array.of(value ? on : 0);
      },
      decode(bytes) {
        const b = (bytes[0] ?? 0) & bits;
        if (mask !== undefined) return b !== 0;
        if (b === 0) return false;
        return b === 1 || anyNonZeroOn ? true : undefined;
      },
    };
  }

  const allowed = optionValues(id);
  return {
    ...base,
    length: 1,
    ...(mask === undefined ? {} : { mask }),
    encode(value) {
      if (typeof value !== 'number' || !Number.isInteger(value) || !allowed.has(value)) {
        refuse(id, value, 'not an offered value');
      }
      return Uint8Array.of(value);
    },
    decode(bytes) {
      const b = bytes[0];
      return b !== undefined && allowed.has(b) ? b : undefined;
    },
  };
}

const FIELD_LAYOUT: readonly FieldLayout[] = [
  // Call display
  { id: 'callDisplayMode', offset: 0xaf },
  { id: 'callSignColour', offset: 0xbc },
  { id: 'lastCaller', offset: 0x4d },
  { id: 'aliasDisplayPriority', offset: 0xed },
  { id: 'aliasTxFormat', offset: 0xee },
  { id: 'showCurrentContact', offset: 0xb9 },
  { id: 'channelNumberStyle', offset: 0xb8 },
  { id: 'showChannelType', offset: 0x110, mask: 0x01 },
  { id: 'showTimeSlot', offset: 0x110, mask: 0x02 },
  { id: 'showColourCode', offset: 0x110, mask: 0x04 },
  // Start-up
  { id: 'powerOnScreen', offset: 0x06 },
  { id: 'powerOnLine1', offset: 0x00, ext: true },
  { id: 'powerOnLine2', offset: 0x20, ext: true },
  { id: 'startupTone', offset: 0x39 },
  { id: 'powerOnVolumeType', offset: 0x155 },
  { id: 'powerOnVolumeLevel', offset: 0x156 },
  // Volume and audio
  { id: 'volumeBar', offset: 0x47, anyNonZeroOn: true },
  { id: 'maxVolume', offset: 0x3b },
  { id: 'maxHeadphoneVolume', offset: 0x52 },
  { id: 'audioProfile', offset: 0x57 },
  { id: 'rxNoiseReduction', offset: 0x148 },
  { id: 'txNoiseReduction', offset: 0x149 },
  { id: 'rxDrc', offset: 0x147 },
  { id: 'dmrMicGain', offset: 0x0f },
  { id: 'analogueMicGain', offset: 0x113 },
  // Tones
  { id: 'keyTone', offset: 0x00 },
  { id: 'talkPermitTone', offset: 0x31 },
  { id: 'callResetTone', offset: 0x32 },
  { id: 'digitalIdleTone', offset: 0x36 },
  { id: 'analogueIdleTone', offset: 0x111 },
  { id: 'smsAlert', offset: 0x29 },
  { id: 'callAlert', offset: 0x2f },
  // Display
  { id: 'displayMode', offset: 0x01 },
  { id: 'backlightLevel', offset: 0x26 },
  { id: 'backlightTimeout', offset: 0x27 },
  { id: 'menuExitTime', offset: 0x37 },
  { id: 'standbyTextColour', offset: 0xc0 },
  { id: 'channelNameColourA', offset: 0xe3 },
  { id: 'channelNameColourB', offset: 0x109 },
  { id: 'zoneNameColourA', offset: 0x10d },
  { id: 'zoneNameColourB', offset: 0x10e },
  { id: 'standbyBackground', offset: 0xc1 },
  { id: 'nightMode', offset: 0x14d },
  { id: 'clockOnStandby', offset: 0x51 },
  { id: 'dateFormat', offset: 0x112 },
  { id: 'timeZone', offset: 0x30 },
  // Keys (short +0x10..0x14, long +0x41..0x45)
  { id: 'keyShortPF1', offset: 0x10 },
  { id: 'keyShortPF2', offset: 0x11 },
  { id: 'keyShortPF3', offset: 0x12 },
  { id: 'keyShortP1', offset: 0x13 },
  { id: 'keyShortP2', offset: 0x14 },
  { id: 'keyLongPF1', offset: 0x41 },
  { id: 'keyLongPF2', offset: 0x42 },
  { id: 'keyLongPF3', offset: 0x43 },
  { id: 'keyLongP1', offset: 0x44 },
  { id: 'keyLongP2', offset: 0x45 },
  { id: 'longPressTime', offset: 0x46 },
  // Power and timers
  { id: 'autoPowerOff', offset: 0x03 },
  { id: 'autoPowerOffType', offset: 0x10f },
  { id: 'txTimeout', offset: 0x04 },
  { id: 'txTimeoutPreAlert', offset: 0x10b },
  { id: 'powerSave', offset: 0x0b },
  // DMR
  { id: 'groupCallHangTime', offset: 0x19 },
  { id: 'privateCallHangTime', offset: 0x1a },
  { id: 'manualDialGroupHangTime', offset: 0x107 },
  { id: 'manualDialPrivateHangTime', offset: 0x108 },
  { id: 'analogueCallHold', offset: 0x50 },
  { id: 'txPreamble', offset: 0x1c },
  { id: 'voiceHeaderRepeats', offset: 0x1b },
  { id: 'smsFormat', offset: 0xc3 },
  { id: 'missedCallFilterOwnId', offset: 0x38 },
];

const SPECS: readonly AtD890SettingsFieldSpec[] = FIELD_LAYOUT.map(specFor);
function buildRegistry(
  specs: readonly AtD890SettingsFieldSpec[],
): ReadonlyMap<string, AtD890SettingsFieldSpec> {
  const map = new Map<string, AtD890SettingsFieldSpec>();
  for (const spec of specs) {
    assertAtD890SettingsSpecPermitted(spec);
    if (map.has(spec.id)) {
      throw new RadioProtocolError(`D890 settings field ${spec.id} is registered twice`);
    }
    map.set(spec.id, spec);
  }
  return map;
}

export const AT_D890_SETTINGS_FIELDS: ReadonlyMap<string, AtD890SettingsFieldSpec> =
  buildRegistry(SPECS);

/**
 * Overrides to patches. Throws before any frame is sent for an unknown field, a field the target
 * does not have, a refused value, a repeated field, or two patches that share a bit.
 */
export function resolveAtD890SettingsPatches(
  overrides: readonly AtD890SettingsOverride[],
  target: AtD890SettingsTarget,
  registry: ReadonlyMap<string, AtD890SettingsFieldSpec> = AT_D890_SETTINGS_FIELDS,
): AtD890SettingsPatch[] {
  const seen = new Set<string>();
  const patches: AtD890SettingsPatch[] = [];
  const claimed = new Map<number, number>();
  for (const { fieldId, value } of overrides) {
    const spec = registry.get(fieldId);
    if (!spec) {
      throw new RadioProtocolError(`D890 setting ${fieldId} is not a writable radio setting`);
    }
    if (!spec.targets.includes(target)) {
      throw new RadioProtocolError(
        `D890 setting ${fieldId} is not available on the ${target} target`,
      );
    }
    if (seen.has(fieldId)) {
      throw new RadioProtocolError(`D890 setting ${fieldId} is set twice`);
    }
    seen.add(fieldId);
    // A custom registry must not skip the allow-list.
    assertAtD890SettingsSpecPermitted(spec);
    const bytes = spec.encode(value);
    if (bytes.length !== spec.length) {
      throw new RadioProtocolError(`D890 setting ${fieldId} encoded ${bytes.length} bytes`);
    }
    const mask = new Uint8Array(spec.length).fill(0xff);
    if (spec.mask !== undefined) mask[0] = spec.mask;
    for (let i = 0; i < spec.length; i++) {
      const address = spec.address + i;
      const bits = claimed.get(address) ?? 0;
      if ((bits & mask[i]!) !== 0) {
        throw new RadioProtocolError(
          `D890 settings ${fieldId} overlaps another setting at ${hex(address)}`,
        );
      }
      claimed.set(address, bits | mask[i]!);
    }
    patches.push({ fieldId, address: spec.address, bytes: bytes.slice(), mask });
  }
  assertAtD890SettingsPatchesPermitted(patches);
  return patches;
}
