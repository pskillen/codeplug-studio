import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import type { Rt95SettingsPatch } from './settingsFields.ts';
import {
  applyRt95SettingsPatchesToImage,
  assertRt95FreshBlockMatchesPrePause,
  mergeRt95SettingsPatchIntoBlock,
  rt95PatchMaskMap,
} from './settingsPatch.ts';

describe('RT95 settingsPatch', () => {
  it('applies a masked patch onto an image', () => {
    const image = createMemoryMap(0x32a0);
    image.bytes.fill(0xff);
    image.bytes[0x3200] = 0xf0;
    const patches: Rt95SettingsPatch[] = [
      {
        fieldId: 'beepVolume',
        address: 0x3200,
        bytes: Uint8Array.of(3),
        mask: Uint8Array.of(0x07),
      },
    ];
    applyRt95SettingsPatchesToImage(image, patches);
    expect(image.bytes[0x3200]).toBe(0xf3);
  });

  it('aborts when fresh read drifted outside the mask', () => {
    const pre = new Uint8Array(16).fill(0xaa);
    const fresh = pre.slice();
    fresh[5] = 0xbb;
    const mask = rt95PatchMaskMap([
      {
        fieldId: 'beepVolume',
        address: 0x3200,
        bytes: Uint8Array.of(1),
        mask: Uint8Array.of(0x07),
      },
    ]);
    expect(() => assertRt95FreshBlockMatchesPrePause(0x3200, pre, fresh, mask)).toThrow(/aborted/);
  });

  it('merges patch into a fresh block buffer', () => {
    const fresh = new Uint8Array(16).fill(0);
    fresh[0xb] = 0x10;
    const merged = mergeRt95SettingsPatchIntoBlock(fresh, 0x3210, [
      {
        fieldId: 'knobMode',
        address: 0x321b,
        bytes: Uint8Array.of(1),
        mask: Uint8Array.of(0x01),
      },
    ]);
    expect(merged[0xb]).toBe(0x11);
  });
});
