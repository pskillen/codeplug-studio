/**
 * MMZ1 v1 layout constants for the UV-5R Mini MM9PDY zone table (external SPI 0xC000-0xCFFF).
 * The byte layout is owned by the firmware project; see docs/reference/radios/baofeng/uv-5r-mini/mm9pdy-data.md.
 * Cardinality (zone count, name length, slot count) comes from `UV5R_MINI_LIMITS`, never from literals here.
 */

export const MMZ1_BASE = 0xc000;
/** Exclusive end of the table's 4 KiB sector. */
export const MMZ1_END = 0xd000;
export const MMZ1_SECTOR_BYTES = 0x1000;

/** One 64-byte header frame, written first (a W to a 4 KiB-aligned address erases the sector). */
export const MMZ1_HEADER_ADDR = 0xc000;
/** Name records: + 16 * i. */
export const MMZ1_NAMES_ADDR = 0xc200;
/** Member bitmaps: + 128 * i. */
export const MMZ1_BITMAPS_ADDR = 0xc400;

export const MMZ1_FRAME_BYTES = 64;
export const MMZ1_NAME_RECORD_BYTES = 16;
export const MMZ1_BITMAP_BYTES = 128;

export const MMZ1_MAGIC = 'MMZ1';
export const MMZ1_VERSION = 1;
