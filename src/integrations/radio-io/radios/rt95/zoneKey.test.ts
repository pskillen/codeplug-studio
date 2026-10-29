import { describe, expect, it } from 'vitest';
import { memoryMapFromBytes } from '../../kit/memoryMap.ts';
import {
  applyRt95ZoneKey,
  RT95_KEY_FUNCTION_DIR,
  rt95ZoneKeyAddress,
  type Rt95ZoneKeyNumber,
} from './zoneKey.ts';

describe('applyRt95ZoneKey', () => {
  it('patches exactly one byte for each of the 12 (group, key) pairs', () => {
    for (const group of [1, 2] as const) {
      for (const key of [1, 2, 3, 4, 5, 6] as Rt95ZoneKeyNumber[]) {
        const before = new Uint8Array(0x4000).map((_, i) => (i * 7) & 0x0b);
        const map = memoryMapFromBytes(before.slice());
        const addr = 0x3250 + (group - 1) * 6 + (key - 1);
        expect(rt95ZoneKeyAddress(group, key)).toBe(addr);
        applyRt95ZoneKey(map, { group, key });
        const diff: number[] = [];
        for (let i = 0; i < before.length; i++) if (map.bytes[i] !== before[i]) diff.push(i);
        expect(diff).toEqual([addr]);
        expect(map.bytes[addr]).toBe(RT95_KEY_FUNCTION_DIR);
      }
    }
  });

  it('leaves the image untouched when unset', () => {
    const before = new Uint8Array(0x4000).fill(3);
    const map = memoryMapFromBytes(before.slice());
    expect(applyRt95ZoneKey(map, undefined)).toEqual({ changed: false });
    expect(map.bytes).toEqual(before);
  });

  it('rejects an out-of-range key', () => {
    const map = memoryMapFromBytes(new Uint8Array(0x4000));
    expect(() => applyRt95ZoneKey(map, { group: 2, key: 7 as Rt95ZoneKeyNumber })).toThrow();
  });
});
