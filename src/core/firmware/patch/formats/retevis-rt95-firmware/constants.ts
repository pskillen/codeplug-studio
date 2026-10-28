/**
 * Format-private wire facts for `retevis-rt95-firmware` patches (format 1). Source: the firmware project's
 * `docs/reference/patch-format.md` and `fw/make_patch.py`; the refused ranges are its protect table
 * (`fw/protect.toml`). Human mirror: docs/reference/radios/retevis/rt95/firmware.md — "Release patch format".
 */
import { RT95_HEAD_FIRMWARE_ROLE } from '../../../../radios/retevis/rt95/firmware.ts';

export const RT95_PATCH_NAME = 'retevis-rt95-firmware';
export const RT95_PATCH_FORMATS = [1] as const;

/** Patch `stock` / `result` wire keys → member roles. */
export const WIRE_TO_ROLE = {
  '.CDD': RT95_HEAD_FIRMWARE_ROLE.CDD,
  '.CDI': RT95_HEAD_FIRMWARE_ROLE.CDI,
  '.spi': RT95_HEAD_FIRMWARE_ROLE.SPI,
} as const;

export type Rt95WireKey = keyof typeof WIRE_TO_ROLE;
export const RT95_WIRE_KEYS = Object.keys(WIRE_TO_ROLE) as Rt95WireKey[];

/** u32 LE image length inside the `.CDI` descriptor. */
export const CDI_LEN_OFF = 0x104;
/** u32 LE image length inside the `.spi`: `{u16 count, u32 total, u32 0}`. Not the D890's +6. */
export const SPI_LEN_OFF = 2;
/** The patched image must end at or below 0x08020000: the end of the 128 KB part (load address 0x08002000). */
export const RT95_MAX_IMAGE = 0x1e000;
/** A hook run is at most this long, and all hooks' `original` bytes together at most the second figure. */
export const RT95_MAX_HOOK_RUN = 32;
export const RT95_MAX_HOOK_ORIGINAL_TOTAL = 256;

export interface Rt95RefusedRange {
  readonly name: string;
  /** `.CDD` file offsets, half-open: file offset = address − 0x08002000. */
  readonly start: number;
  readonly end: number;
}

/**
 * Byte ranges no hook may touch. The flasher-interface rows plus the build-side additions, in the order of the
 * firmware project's `fw/protect.toml`.
 */
export const RT95_REFUSED_RANGES: readonly Rt95RefusedRange[] = [
  { name: 'vector table (initial SP and reset)', start: 0x0000, end: 0x0008 },
  { name: 'MAIN-update bridge', start: 0x2f1c, end: 0x3018 },
  { name: 'MAIN-update bridge call in main', start: 0x150ee, end: 0x150f2 },
  { name: 'model string', start: 0x15360, end: 0x15367 },
  { name: 'model-string literal', start: 0x3074, end: 0x3078 },
  { name: 'PC-link ident model copy', start: 0x1522d, end: 0x15234 },
  { name: 'PC-link ident version copy', start: 0x15234, end: 0x15238 },
  { name: 'model-string literal in the redraw', start: 0x9108, end: 0x910c },
  { name: 'PC-link handler', start: 0x13058, end: 0x13c20 },
  { name: 'PROGRAM string', start: 0x15216, end: 0x1521e },
  { name: 'PC-link call in the main loop', start: 0x11e72, end: 0x11e76 },
];
