/**
 * RT95 MM9PDY optional "Zone on a P-key": sets one key-table byte to the stock DIR function,
 * which the MM9PDY firmware uses for the zone selector (shown on the radio as ZON).
 * Touches exactly one byte, inside the stock clone image (0x3250-0x325B).
 */

import type { MemoryMap } from '../../types.ts';

export const RT95_KEY_TABLE_ADDR = 0x3250;
export const RT95_KEY_TABLE_LENGTH = 12;
/** Stored value of DIR (CHIRP option index 13, stored index + 1). */
export const RT95_KEY_FUNCTION_DIR = 0x0e;

export type Rt95ZoneKeyGroup = 1 | 2;
export type Rt95ZoneKeyNumber = 1 | 2 | 3 | 4 | 5 | 6;
export interface Rt95ZoneKey {
  group: Rt95ZoneKeyGroup;
  key: Rt95ZoneKeyNumber;
}

export function rt95ZoneKeyAddress(group: Rt95ZoneKeyGroup, key: Rt95ZoneKeyNumber): number {
  return RT95_KEY_TABLE_ADDR + (group - 1) * 6 + (key - 1);
}

/** Set the chosen key to DIR in place. No-op when `zoneKey` is undefined. */
export function applyRt95ZoneKey(
  image: MemoryMap,
  zoneKey: Rt95ZoneKey | undefined,
): { changed: boolean; previous?: number } {
  if (!zoneKey) return { changed: false };
  const addr = rt95ZoneKeyAddress(zoneKey.group, zoneKey.key);
  if (
    !Number.isInteger(addr) ||
    addr < RT95_KEY_TABLE_ADDR ||
    addr >= RT95_KEY_TABLE_ADDR + RT95_KEY_TABLE_LENGTH
  ) {
    throw new Error(`RT95 zone key address 0x${addr.toString(16)} is outside the key table.`);
  }
  const previous = image.bytes[addr]!;
  image.bytes[addr] = RT95_KEY_FUNCTION_DIR;
  return { changed: previous !== RT95_KEY_FUNCTION_DIR, previous };
}
