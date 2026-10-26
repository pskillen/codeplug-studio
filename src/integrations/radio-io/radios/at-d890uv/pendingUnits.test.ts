import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AT_D890_PENDING_UNITS_KEY,
  AtD890PendingUnitsError,
  clearAtD890PendingUnits,
  describeAtD890PendingUnits,
  readAtD890PendingUnits,
  recordAtD890PendingUnits,
} from './pendingUnits.ts';

beforeEach(() => clearAtD890PendingUnits());
afterEach(() => {
  vi.restoreAllMocks();
  clearAtD890PendingUnits();
});

describe('AT-D890 pending units record (#1406)', () => {
  it('records a union, ascending, and clears only the committed units', () => {
    recordAtD890PendingUnits([0x0360_0000, 0x0348_0000]);
    recordAtD890PendingUnits([0x0348_0000, 0x0700_0000]);
    expect(readAtD890PendingUnits()).toEqual([0x0348_0000, 0x0360_0000, 0x0700_0000]);
    clearAtD890PendingUnits([0x0348_0000, 0x0999_0000]);
    expect(readAtD890PendingUnits()).toEqual([0x0360_0000, 0x0700_0000]);
    clearAtD890PendingUnits();
    expect(readAtD890PendingUnits()).toEqual([]);
    expect(localStorage.getItem(AT_D890_PENDING_UNITS_KEY)).toBeNull();
  });

  it('records nothing for an empty set', () => {
    recordAtD890PendingUnits([]);
    expect(localStorage.getItem(AT_D890_PENDING_UNITS_KEY)).toBeNull();
  });

  it('ignores a corrupt record', () => {
    localStorage.setItem(AT_D890_PENDING_UNITS_KEY, '{nope');
    expect(readAtD890PendingUnits()).toEqual([]);
    localStorage.setItem(AT_D890_PENDING_UNITS_KEY, JSON.stringify({ v: 2, units: [1] }));
    expect(readAtD890PendingUnits()).toEqual([]);
  });

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => recordAtD890PendingUnits([0x0348_0000])).not.toThrow();
    expect(readAtD890PendingUnits()).toEqual([]);
  });

  it('the warning names the units and the full re-Write', () => {
    const text = describeAtD890PendingUnits([0x0348_0000, 0x0700_0000]);
    expect(text).toContain('0x3480000');
    expect(text).toContain('0x7000000');
    expect(text).toMatch(/full Write/);
    expect(text).toMatch(/CPS/);
    expect(new AtD890PendingUnitsError([0x0348_0000]).message).toMatch(/Nothing was sent/);
  });
});
