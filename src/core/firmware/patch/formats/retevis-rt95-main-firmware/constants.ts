/**
 * Format-private wire facts for `retevis-rt95-main-firmware` patches (format 1): patches for the RT95 main board
 * (MAIN, "RF CPU"). Source: the firmware project's `docs/reference/patch-format.md` (MAIN section),
 * `fw/make_patch.py` (`apply_main`), `fw/main/profile.toml` and `fw/main/protect.toml` (decision D35, record D37).
 * Human mirror: docs/reference/radios/retevis/rt95/firmware.md — "Main board patch format".
 */
import { RT95_HEAD_FIRMWARE_ROLE } from '../../../../radios/retevis/rt95/firmware.ts';

export const RT95_MAIN_PATCH_NAME = 'retevis-rt95-main-firmware';
export const RT95_MAIN_PATCH_FORMATS = [1] as const;

/** Patch `stock` / `result` wire keys → member roles (the same three-file package shape as the head). */
export const WIRE_TO_ROLE = {
  '.CDD': RT95_HEAD_FIRMWARE_ROLE.CDD,
  '.CDI': RT95_HEAD_FIRMWARE_ROLE.CDI,
  '.spi': RT95_HEAD_FIRMWARE_ROLE.SPI,
} as const;
export type Rt95MainWireKey = keyof typeof WIRE_TO_ROLE;
export const RT95_MAIN_WIRE_KEYS = Object.keys(WIRE_TO_ROLE) as Rt95MainWireKey[];

/** u32 LE image length inside the `.CDI` descriptor. */
export const CDI_LEN_OFF = 0x104;
/** u32 LE image length inside the `.spi`: `{u16 count, u32 total, u32 0}`. */
export const SPI_LEN_OFF = 2;

/** The image length: the stock `.CDD` carries 40 more bytes after this, which are never sent and never kept. */
export const RT95_MAIN_IMAGE_LEN = 0xd93c;
/** The one hook site (`bl 0x0800B088` at 0x08002382): file offset, length and the stock bytes there. */
export const RT95_MAIN_HOOK_OFFSET = 0x382;
export const RT95_MAIN_HOOK_LEN = 4;
export const RT95_MAIN_HOOK_ORIGINAL = Uint8Array.of(0x08, 0xf0, 0x81, 0xfe);
/** The patched image ends at or before file 0xDC00 (address 0x0800FC00). */
export const RT95_MAIN_WINDOW_END = 0xdc00;
export const RT95_MAIN_MAX_APPEND = RT95_MAIN_WINDOW_END - RT95_MAIN_IMAGE_LEN; // 708

export interface Rt95MainRefusedRange {
  readonly name: string;
  /** `.CDD` file offsets, half-open: file offset = address − 0x08002000. */
  readonly start: number;
  readonly end: number;
}

/** Byte ranges no hook may touch: the firmware project's `fw/main/protect.toml`. */
export const RT95_MAIN_REFUSED_RANGES: readonly Rt95MainRefusedRange[] = [
  { name: 'vector table', start: 0x0000, end: 0x0150 },
  { name: 'model string', start: 0xd65c, end: 0xd663 },
  { name: 'RF CPU version constant', start: 0xd667, end: 0xd669 },
  { name: 'scatter-load table and RW-init data', start: 0xd8d8, end: 0xd93c },
  { name: 'EEPROM read routine', start: 0x94e4, end: 0x958c },
  { name: 'EEPROM write routine', start: 0x958c, end: 0x9648 },
  { name: 'RF write routine', start: 0x9792, end: 0x97ea },
];
