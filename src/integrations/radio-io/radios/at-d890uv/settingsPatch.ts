/**
 * Applying AT-D890UV settings patches (#1393): onto a fresh erase-unit read, onto an image, and
 * onto a sentinel span for the cross-session verify (`before ⊕ patches`).
 */

import type { MemoryMap } from '../../types.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import { AT_D890_ERASE_UNIT_BYTES, eraseUnitBaseFor } from './eraseUnits.ts';
import { D890_MAP } from './constants.ts';
import type { AtD890SettingsPatch } from './settingsFields.ts';

function mergeByte(current: number, patchByte: number, mask: number): number {
  return (current & ~mask & 0xff) | (patchByte & mask);
}

/** Patch a fresh erase-unit buffer in place. Bits outside each patch's mask are untouched. */
export function applyAtD890SettingsPatchesToUnit(
  unitBase: number,
  unit: Uint8Array,
  patches: readonly AtD890SettingsPatch[],
): void {
  for (const patch of patches) {
    const last = patch.address + patch.bytes.length - 1;
    if (eraseUnitBaseFor(patch.address) !== unitBase || eraseUnitBaseFor(last) !== unitBase) {
      throw new RadioProtocolError(
        `D890 settings patch ${patch.fieldId} is not in erase unit 0x${unitBase.toString(16)}`,
      );
    }
    for (let i = 0; i < patch.bytes.length; i++) {
      const at = patch.address + i - unitBase;
      unit[at] = mergeByte(unit[at]!, patch.bytes[i]!, patch.mask[i]!);
    }
  }
}

/** Same patch applied to an image (preview and tests). */
export function applyAtD890SettingsPatchesToImage(
  image: MemoryMap,
  patches: readonly AtD890SettingsPatch[],
): void {
  for (const patch of patches) {
    const current = image.get(patch.address, patch.bytes.length).slice();
    for (let i = 0; i < current.length; i++) {
      current[i] = mergeByte(current[i]!, patch.bytes[i]!, patch.mask[i]!);
    }
    image.set(patch.address, current);
  }
}

/** Byte address to the bits the patches may change there. */
export function atD890PatchMaskMap(patches: readonly AtD890SettingsPatch[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const patch of patches) {
    for (let i = 0; i < patch.bytes.length; i++) {
      const address = patch.address + i;
      out.set(address, (out.get(address) ?? 0) | patch.mask[i]!);
    }
  }
  return out;
}

/**
 * The span as it should read after the patches: `before` with each patch applied. Patches outside
 * `[spanStart, spanStart + bytes.length)` are ignored. Returns a copy.
 */
export function applyAtD890SettingsPatchesToBytes(
  spanStart: number,
  bytes: Uint8Array,
  patches: readonly AtD890SettingsPatch[],
): Uint8Array {
  const out = bytes.slice();
  for (const patch of patches) {
    for (let i = 0; i < patch.bytes.length; i++) {
      const at = patch.address + i - spanStart;
      if (at < 0 || at >= out.length) continue;
      out[at] = mergeByte(out[at]!, patch.bytes[i]!, patch.mask[i]!);
    }
  }
  return out;
}

function allFf(unit: Uint8Array, start: number, length: number): boolean {
  for (let i = 0; i < length; i++) {
    if (unit[start + i] !== 0xff) return false;
  }
  return true;
}

/**
 * After patching, the main record and the power-on block must not read erased: the next Write's
 * plausibility check would refuse the radio (W8).
 */
export function assertAtD890SentinelSpansNotErased(unitBase: number, unit: Uint8Array): void {
  if (unit.length !== AT_D890_ERASE_UNIT_BYTES) {
    throw new RadioProtocolError('D890 settings unit buffer has the wrong length');
  }
  const spans = [
    { id: 'OptionalSettingsMain', start: D890_MAP.OptionalSettingsMain, length: 0x200 },
    { id: 'OptionalSettingsExt', start: D890_MAP.OptionalSettingsExt, length: 0x60 },
  ];
  for (const span of spans) {
    if (allFf(unit, span.start - unitBase, span.length)) {
      throw new RadioProtocolError(
        `D890 settings patch would leave ${span.id} erased (all 0xff) — refuse Write`,
      );
    }
  }
}
