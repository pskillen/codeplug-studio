import { describe, expect, it } from 'vitest';
import { resolveDataTableVirtualization, VIRTUAL_ROW_THRESHOLD } from './virtualization.ts';

describe('resolveDataTableVirtualization', () => {
  it('enables auto mode at the row threshold', () => {
    expect(resolveDataTableVirtualization('auto', VIRTUAL_ROW_THRESHOLD - 1)).toBe(false);
    expect(resolveDataTableVirtualization('auto', VIRTUAL_ROW_THRESHOLD)).toBe(true);
  });

  it('respects explicit true/false', () => {
    expect(resolveDataTableVirtualization(true, 1)).toBe(true);
    expect(resolveDataTableVirtualization(false, 10_000)).toBe(false);
  });
});
