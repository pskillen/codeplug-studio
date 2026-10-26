import { describe, expect, it } from 'vitest';
import { isAtD890DigitalContactUnit } from './digitalContactUnits.ts';

describe('isAtD890DigitalContactUnit', () => {
  it('accepts the meta, order and data A halves', () => {
    expect(isAtD890DigitalContactUnit(0x0700_0000)).toBe(true);
    expect(isAtD890DigitalContactUnit(0x0708_0000)).toBe(true);
    expect(isAtD890DigitalContactUnit(0x0708_0000 + 15 * 0x8_0000)).toBe(true);
    expect(isAtD890DigitalContactUnit(0x0790_0000)).toBe(true);
    expect(isAtD890DigitalContactUnit(0x0790_0000 + 499 * 0x8_0000)).toBe(true);
  });

  it('rejects the +0x40000 halves, out-of-range banks, odd units and other units', () => {
    expect(isAtD890DigitalContactUnit(0x0704_0000)).toBe(false);
    expect(isAtD890DigitalContactUnit(0x0708_0000 + 0x4_0000)).toBe(false);
    expect(isAtD890DigitalContactUnit(0x0708_0000 + 16 * 0x8_0000)).toBe(false);
    expect(isAtD890DigitalContactUnit(0x0790_0000 + 500 * 0x8_0000)).toBe(false);
    expect(isAtD890DigitalContactUnit(0x0790_0000 + 0x4_0000)).toBe(false);
    expect(isAtD890DigitalContactUnit(0x0700_0010)).toBe(false);
    expect(isAtD890DigitalContactUnit(0x04a8_0000)).toBe(false);
    expect(isAtD890DigitalContactUnit(0x06f8_0000)).toBe(false);
  });
});
