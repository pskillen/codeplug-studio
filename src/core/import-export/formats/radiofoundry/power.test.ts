import { describe, expect, it } from 'vitest';
import { radioFoundryByteToLevel, radioFoundryLevelToByte } from './power';

describe('radioFoundryLevelToByte', () => {
  it('spreads five levels over the ten steps', () => {
    expect([0, 1, 2, 3, 4].map((level) => radioFoundryLevelToByte(level, 5))).toEqual([
      1, 3, 6, 8, 10,
    ]);
  });

  it('is level + 1 for nine levels', () => {
    for (let level = 0; level < 9; level++) {
      expect(radioFoundryLevelToByte(level, 9)).toBe(level + 1);
    }
  });

  it('has vectors for two and three levels', () => {
    expect([0, 1].map((level) => radioFoundryLevelToByte(level, 2))).toEqual([1, 10]);
    expect([0, 1, 2].map((level) => radioFoundryLevelToByte(level, 3))).toEqual([1, 6, 10]);
  });
});

describe('radioFoundryByteToLevel', () => {
  it('reads byte 0 as the radio default', () => {
    expect(radioFoundryByteToLevel(0, 5)).toBeNull();
  });

  it('maps every five-level byte to a level, clamping above ten', () => {
    const bytes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 200, 255];
    expect(bytes.map((byte) => radioFoundryByteToLevel(byte, 5))).toEqual([
      0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 4, 4,
    ]);
  });

  it('clamps nine levels', () => {
    expect(radioFoundryByteToLevel(9, 9)).toBe(8);
    expect(radioFoundryByteToLevel(200, 9)).toBe(8);
  });

  it('round-trips every level for counts 1 to 12', () => {
    for (let count = 1; count <= 12; count++) {
      for (let level = 0; level < count; level++) {
        const byte = radioFoundryLevelToByte(level, count);
        expect(radioFoundryByteToLevel(byte, count)).toBe(level);
      }
    }
  });
});
