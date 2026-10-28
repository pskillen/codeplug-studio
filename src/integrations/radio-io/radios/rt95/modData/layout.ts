/**
 * MMD1 v1 layout constants for the RT95 MM9PDY data table (EEPROM 0x4000-0x5FFF).
 * The byte layout is owned by the firmware repo; see docs/reference/radios/retevis/rt95/mm9pdy-data.md.
 * Cardinality (zone count, name lengths, ...) comes from `RT95_LIMITS`, never from literals here.
 */

export const MMD1_BASE = 0x4000;
/** Exclusive hard write ceiling. */
export const MMD1_END = 0x6000;
/** Alias of the ident on a 16 KiB chip: never written, only read by the chip guard. */
export const RT95_NEVER_WRITE_FROM = 0x7b00;

export const MMD1_HEADER_ADDR = 0x4000;
/** Radio state block: written by the radio only (and by a Restore). */
export const MMD1_STATE_ADDR = 0x4010;
/** Zone name blocks: + 16 * i. */
export const MMD1_NAMES_ADDR = 0x4100;
/** Zone member slots: + 32 * i. */
export const MMD1_SLOTS_ADDR = 0x4300;
/** Description blocks: + 16 * n. */
export const MMD1_DESCRIPTIONS_ADDR = 0x5000;

export const MMD1_BLOCK_BYTES = 16;
export const MMD1_SLOT_BYTES = 32;

export const MMD1_MAGIC = 'MMD1';
export const MMD1_VERSION = 1;
export const MMD1_STATE_MAGIC = 'ZST1';

export const RT95_GUARD_IDENT_ADDR = 0x3b00;
export const RT95_GUARD_ALIAS_ADDR = 0x7b00;
/** "RT95-P\0" */
export const RT95_IDENT_PREFIX = new Uint8Array([0x52, 0x54, 0x39, 0x35, 0x2d, 0x50, 0x00]);
