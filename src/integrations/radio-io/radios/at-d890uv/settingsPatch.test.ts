import { describe, expect, it } from 'vitest';
import { RadioProtocolError } from '../../kit/errors.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { AT_D890_ERASE_UNIT_BYTES } from './eraseUnits.ts';
import type { AtD890SettingsPatch } from './settingsFields.ts';
import {
  applyAtD890SettingsPatchesToBytes,
  applyAtD890SettingsPatchesToImage,
  applyAtD890SettingsPatchesToUnit,
  assertAtD890SentinelSpansNotErased,
  atD890PatchMaskMap,
} from './settingsPatch.ts';

const BASE = 0x3500000;

function patch(address: number, bytes: number[], mask?: number[]): AtD890SettingsPatch {
  return {
    fieldId: 'synthetic',
    address,
    bytes: Uint8Array.from(bytes),
    mask: Uint8Array.from(mask ?? bytes.map(() => 0xff)),
  };
}

describe('AT-D890 settings patches', () => {
  it('keeps neighbour bits under a masked patch', () => {
    const unit = new Uint8Array(AT_D890_ERASE_UNIT_BYTES).fill(0xff);
    unit[0x40] = 0xfe;
    applyAtD890SettingsPatchesToUnit(BASE, unit, [patch(BASE + 0x40, [0x01], [0x01])]);
    expect(unit[0x40]).toBe(0xff);
    unit[0x40] = 0xfe;
    applyAtD890SettingsPatchesToUnit(BASE, unit, [patch(BASE + 0x40, [0x00], [0x01])]);
    expect(unit[0x40]).toBe(0xfe);
    unit[0x40] = 0xa5;
    applyAtD890SettingsPatchesToUnit(BASE, unit, [patch(BASE + 0x40, [0xff], [0x0f])]);
    expect(unit[0x40]).toBe(0xaf);
  });

  it('ignores bytes outside the mask in the patch value', () => {
    const unit = new Uint8Array(AT_D890_ERASE_UNIT_BYTES).fill(0x00);
    applyAtD890SettingsPatchesToUnit(BASE, unit, [patch(BASE + 0x41, [0xf3], [0x03])]);
    expect(unit[0x41]).toBe(0x03);
  });

  it('refuses a patch outside the unit', () => {
    const unit = new Uint8Array(AT_D890_ERASE_UNIT_BYTES);
    expect(() =>
      applyAtD890SettingsPatchesToUnit(BASE, unit, [patch(BASE + AT_D890_ERASE_UNIT_BYTES, [1])]),
    ).toThrow(RadioProtocolError);
    expect(() => applyAtD890SettingsPatchesToUnit(BASE, unit, [patch(BASE - 1, [1])])).toThrow(
      RadioProtocolError,
    );
  });

  it('image and unit variants agree', () => {
    const patches = [patch(BASE + 0x13, [14]), patch(BASE + 0x40, [0x05], [0x0f])];
    const unit = new Uint8Array(AT_D890_ERASE_UNIT_BYTES);
    for (let i = 0; i < 0x100; i++) unit[i] = (i * 13 + 5) & 0xff;
    const img = createMemoryMap(BASE + 0x200);
    img.bytes.set(unit.subarray(0, 0x200), BASE);
    applyAtD890SettingsPatchesToUnit(BASE, unit, patches);
    applyAtD890SettingsPatchesToImage(img, patches);
    expect(img.bytes.subarray(BASE, BASE + 0x100)).toEqual(unit.subarray(0, 0x100));
  });

  it('computes before ⊕ patches for a span and leaves the input alone', () => {
    const before = new Uint8Array(0x200).fill(0x11);
    const after = applyAtD890SettingsPatchesToBytes(BASE, before, [
      patch(BASE + 0x13, [14]),
      patch(BASE + 0x14, [0x00], [0x0f]),
      patch(BASE + 0x900, [9]),
    ]);
    expect(after[0x13]).toBe(14);
    expect(after[0x14]).toBe(0x10);
    expect(after[0x15]).toBe(0x11);
    expect(before[0x13]).toBe(0x11);
    expect(after.length).toBe(0x200);
  });

  it('maps patched bytes to their masks', () => {
    const m = atD890PatchMaskMap([patch(BASE + 0x13, [1, 2]), patch(BASE + 0x40, [1], [0x03])]);
    expect(m.get(BASE + 0x13)).toBe(0xff);
    expect(m.get(BASE + 0x14)).toBe(0xff);
    expect(m.get(BASE + 0x40)).toBe(0x03);
    expect(m.size).toBe(3);
  });

  it('refuses a unit whose sentinel spans read erased', () => {
    const unit = new Uint8Array(AT_D890_ERASE_UNIT_BYTES).fill(0xff);
    unit[0] = 0x01;
    expect(() => assertAtD890SentinelSpansNotErased(BASE, unit)).toThrow(/OptionalSettingsExt/);
    unit[0x900] = 0x01;
    expect(() => assertAtD890SentinelSpansNotErased(BASE, unit)).not.toThrow();
    unit[0] = 0xff;
    expect(() => assertAtD890SentinelSpansNotErased(BASE, unit)).toThrow(/OptionalSettingsMain/);
  });
});
