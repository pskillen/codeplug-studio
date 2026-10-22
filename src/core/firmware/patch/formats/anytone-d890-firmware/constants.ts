/**
 * Format-private wire facts for `anytone-d890-firmware` patches (format 1). Source: the firmware project's
 * `fw/make_patch.py`.
 */
import { AT_D890UV_FIRMWARE_ROLE } from '../../../../radios/anytone/at-d890uv/firmware.ts';

export const D890_PATCH_NAME = 'anytone-d890-firmware';
export const D890_PATCH_FORMATS = [1] as const;

/** Patch `stock` / `result` wire keys → member roles. */
export const WIRE_TO_ROLE = {
  '.CDD': AT_D890UV_FIRMWARE_ROLE.CDD,
  '.CDI': AT_D890UV_FIRMWARE_ROLE.CDI,
  '.spi': AT_D890UV_FIRMWARE_ROLE.SPI,
} as const;

export type D890WireKey = keyof typeof WIRE_TO_ROLE;
export const D890_WIRE_KEYS = Object.keys(WIRE_TO_ROLE) as D890WireKey[];

/** u32 LE image length inside the `.CDI` descriptor. */
export const CDI_LEN_OFF = 0x104;
/** u32 LE image length inside the `.spi` header. */
export const SPI_LEN_OFF = 6;
