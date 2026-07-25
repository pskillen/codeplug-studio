import { describe, expect, it } from 'vitest';
import { ctcssHzFromIndex, ctcssIndexFromHz } from './ctcssToneTable.ts';

describe('ctcssToneTable', () => {
  it('maps 88.5 Hz to index 9', () => {
    expect(ctcssIndexFromHz(88.5)).toBe(9);
    expect(ctcssHzFromIndex(9)).toBe(88.5);
  });

  it('returns 0 / null for unknown or custom indices', () => {
    expect(ctcssIndexFromHz(123.45)).toBe(0);
    expect(ctcssHzFromIndex(51)).toBeNull();
    expect(ctcssHzFromIndex(0)).toBeNull();
  });
});
