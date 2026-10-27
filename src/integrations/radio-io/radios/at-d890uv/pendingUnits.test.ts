import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AT_D890_PENDING_UNITS_KEY,
  AT_D890_UNKNOWN_RADIO,
  AtD890PendingUnitsError,
  atD890PartsToTick,
  clearAllAtD890PendingRecords,
  clearAtD890PendingRadios,
  clearAtD890PendingUnits,
  describeAtD890PendingUnits,
  findAtD890PendingBlock,
  findLatestAtD890PendingBlock,
  markAtD890WriteInProgress,
  readAtD890PendingUnits,
  recordAtD890PendingUnits,
  settleAtD890InProgress,
} from './pendingUnits.ts';

const A = 'SN-A';
const B = 'SN-B';
const MAIN = 0x0348_0000;
const MAIN2 = 0x0360_0000;
const CONTACT_META = 0x0700_0000;
const CONTACT_ORDER = 0x0708_0000;

beforeEach(() => clearAllAtD890PendingRecords());
afterEach(() => {
  vi.restoreAllMocks();
  clearAllAtD890PendingRecords();
});

describe('AT-D890 pending units record (#1406)', () => {
  it('records a union per radio, ascending, and clears only the committed units', () => {
    recordAtD890PendingUnits(A, [MAIN2, MAIN]);
    recordAtD890PendingUnits(A, [MAIN, CONTACT_META]);
    expect(readAtD890PendingUnits(A)).toEqual([MAIN, MAIN2, CONTACT_META]);
    clearAtD890PendingUnits(A, [MAIN, 0x0999_0000]);
    expect(readAtD890PendingUnits(A)).toEqual([MAIN2, CONTACT_META]);
    clearAtD890PendingRadios([A]);
    expect(readAtD890PendingUnits(A)).toEqual([]);
    expect(localStorage.getItem(AT_D890_PENDING_UNITS_KEY)).toBeNull();
  });

  it('records nothing for an empty set', () => {
    recordAtD890PendingUnits(A, []);
    expect(localStorage.getItem(AT_D890_PENDING_UNITS_KEY)).toBeNull();
  });

  it('keys the record by radio: a record for A does not block B', () => {
    recordAtD890PendingUnits(A, [MAIN]);
    expect(findAtD890PendingBlock(A)?.units).toEqual([MAIN]);
    expect(findAtD890PendingBlock(B)).toBeNull();
    expect(findAtD890PendingBlock(A)?.recordedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
  });

  it('a record under the unknown radio, or an unknown current serial, is a hard block', () => {
    recordAtD890PendingUnits(AT_D890_UNKNOWN_RADIO, [MAIN]);
    expect(findAtD890PendingBlock(A)).toMatchObject({ hard: true, units: [MAIN] });
    clearAllAtD890PendingRecords();
    recordAtD890PendingUnits(A, [MAIN]);
    expect(findAtD890PendingBlock('')).toMatchObject({ hard: true, radios: [A] });
    expect(findAtD890PendingBlock(A)?.hard).toBe(false);
  });

  it('clearing a block removes exactly its radios', () => {
    recordAtD890PendingUnits(A, [MAIN]);
    recordAtD890PendingUnits(B, [MAIN2]);
    clearAtD890PendingRadios(findAtD890PendingBlock(A)!.radios);
    expect(findAtD890PendingBlock(A)).toBeNull();
    expect(findAtD890PendingBlock(B)?.units).toEqual([MAIN2]);
  });

  it('the latest block is the most recently recorded one', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-27T10:00:00Z'));
    recordAtD890PendingUnits(A, [MAIN]);
    vi.setSystemTime(new Date('2026-10-27T11:00:00Z'));
    recordAtD890PendingUnits(B, [MAIN2]);
    expect(findLatestAtD890PendingBlock()?.radios).toEqual([B]);
    vi.useRealTimers();
  });

  it('an in-progress marker counts as pending, the unit in progress included', () => {
    markAtD890WriteInProgress(A, 's1', [MAIN]);
    markAtD890WriteInProgress(A, 's1', [MAIN, MAIN2]);
    const block = findAtD890PendingBlock(A)!;
    expect(block.units).toEqual([MAIN, MAIN2]);
    expect(block.interrupted).toBe(true);
    expect(describeAtD890PendingUnits(block)).toMatch(/cut off/);
  });

  it('settling drops the session marker; END clears its units and marker', () => {
    markAtD890WriteInProgress(A, 's1', [MAIN]);
    settleAtD890InProgress(A, 'other-session');
    expect(findAtD890PendingBlock(A)).not.toBeNull();
    settleAtD890InProgress(A, 's1');
    expect(findAtD890PendingBlock(A)).toBeNull();
    markAtD890WriteInProgress(A, 's2', [MAIN, MAIN2]);
    clearAtD890PendingUnits(A, [MAIN, MAIN2], 's2');
    expect(findAtD890PendingBlock(A)).toBeNull();
  });

  it("a different session's marker is folded into the pending units, not overwritten", () => {
    markAtD890WriteInProgress(A, 'crashed', [MAIN]);
    markAtD890WriteInProgress(A, 'next', [MAIN2]);
    expect(readAtD890PendingUnits(A)).toEqual([MAIN, MAIN2]);
    settleAtD890InProgress(A, 'next');
    expect(readAtD890PendingUnits(A)).toEqual([MAIN]);
  });

  it('ignores a corrupt or old-format record', () => {
    localStorage.setItem(AT_D890_PENDING_UNITS_KEY, '{nope');
    expect(findAtD890PendingBlock(A)).toBeNull();
    localStorage.setItem(AT_D890_PENDING_UNITS_KEY, JSON.stringify({ v: 1, units: [1] }));
    expect(findAtD890PendingBlock(A)).toBeNull();
  });

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => recordAtD890PendingUnits(A, [MAIN])).not.toThrow();
    expect(() => markAtD890WriteInProgress(A, 's', [MAIN])).not.toThrow();
    expect(findAtD890PendingBlock(A)).toBeNull();
  });
});

describe('AT-D890 pending units text (#1406)', () => {
  it('names the parts to tick in plain words', () => {
    expect(atD890PartsToTick([MAIN])).toBe('Codeplug ticked');
    expect(atD890PartsToTick([CONTACT_META, CONTACT_ORDER])).toBe('Digital contacts ticked');
    expect(atD890PartsToTick([MAIN, CONTACT_META])).toBe('Codeplug and Digital contacts ticked');
  });

  it('says contacts only when contact units are involved, and lists addresses last', () => {
    recordAtD890PendingUnits(A, [MAIN, MAIN2]);
    const text = describeAtD890PendingUnits(findAtD890PendingBlock(A)!);
    expect(text).toMatch(/Codeplug ticked/);
    expect(text).not.toMatch(/contacts/i);
    expect(text.indexOf('Codeplug ticked')).toBeLessThan(text.indexOf('0x3480000'));
    expect(text).toMatch(/clear the warning/);
    expect(text).toMatch(/recorded \d{4}-\d\d-\d\d \d\d:\d\d UTC/);
    recordAtD890PendingUnits(A, [CONTACT_META]);
    expect(describeAtD890PendingUnits(findAtD890PendingBlock(A)!)).toMatch(
      /Codeplug and Digital contacts ticked/,
    );
  });

  it('a hard block says no Write can repair it', () => {
    recordAtD890PendingUnits(AT_D890_UNKNOWN_RADIO, [MAIN]);
    const err = new AtD890PendingUnitsError(findAtD890PendingBlock(A)!);
    expect(err.message).toMatch(/no Write can repair/);
    expect(err.message).toMatch(/Nothing was sent/);
    expect(err.units).toEqual([MAIN]);
  });
});
