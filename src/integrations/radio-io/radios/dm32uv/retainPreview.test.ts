/**
 * DM-32UV retain preview key-function names.
 */

import { describe, expect, it } from 'vitest';
import { DM32_BLOCK_SIZE } from './constants.ts';
import { settingsRetainPreview } from './retainPreview.ts';

function sideKey1Value(shortByte: number, longByte = 0): string {
  const data = new Uint8Array(DM32_BLOCK_SIZE);
  data[0x87] = shortByte;
  data[0x88] = longByte;
  const row = settingsRetainPreview(data).find((entry) => entry.label === 'Side key 1');
  expect(row).toBeDefined();
  return row!.value;
}

describe('settingsRetainPreview key functions', () => {
  it('names code 8 on side key 1 short as Alarm', () => {
    const value = sideKey1Value(8);
    expect(value).toContain('Alarm');
    expect(value).not.toContain('Function 8');
  });

  it('names code 1 as Power Select', () => {
    const value = sideKey1Value(1);
    expect(value).toContain('Power Select');
    expect(value).not.toContain('Monitor');
  });

  it('names code 42 as Man Down Alarm', () => {
    expect(sideKey1Value(42)).toContain('Man Down Alarm');
  });

  it('renders bytes outside 0–42 as Function N with the raw byte', () => {
    expect(sideKey1Value(43)).toContain('Function 43');
    const masked = sideKey1Value(0x81);
    expect(masked).toContain('Function 129');
    expect(masked).not.toContain('Power Select');
    const unset = sideKey1Value(255, 255);
    expect(unset).toBe('Function 255 (short) / Function 255 (long)');
    expect(unset).not.toContain('None');
  });
});
