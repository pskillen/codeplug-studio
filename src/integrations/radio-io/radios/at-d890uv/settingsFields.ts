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
    const address = spec.address + i;
    const where = `D890 settings field ${spec.id} covers ${hex(address)}`;
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
}

/** Short-press key function index, `0..64` (firmware function list). */
function keyFunctionField(id: string, offset: number): AtD890SettingsFieldSpec {
  return {
    id,
    address: MAIN + offset,
    length: 1,
    targets: ['stock', 'mm9pdy'],
    advanced: false,
    encode(value) {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 64) {
        throw new RadioProtocolError(`D890 setting ${id}: ${String(value)} is not a key function`);
      }
      return Uint8Array.of(value);
    },
    decode(bytes) {
      const b = bytes[0];
      return b !== undefined && b <= 64 ? b : undefined;
    },
  };
}

const SPECS: readonly AtD890SettingsFieldSpec[] = [
  keyFunctionField('keyShortP1', 0x13),
  keyFunctionField('keyShortP2', 0x14),
];

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
  return patches;
}
