/**
 * Format-private wire facts for `baofeng-uv5rmini-firmware` patches (format 1). Source: the firmware project's
 * `docs/reference/patch-format.md` and its `tools/make_patch.py`. Human mirror:
 * docs/reference/radios/baofeng/uv-5r-mini/firmware.md — "Release patch format".
 */
import { UV5RMINI_FIRMWARE_ROLE_UFW } from '../../../../radios/baofeng/uv-5r-mini/firmware.ts';

export const UV5RMINI_PATCH_NAME = 'baofeng-uv5rmini-firmware';
export const UV5RMINI_PATCH_FORMATS = [1] as const;

/** Patch `stock` / `result` wire keys → member roles. */
export const WIRE_TO_ROLE = {
  '.ufw': UV5RMINI_FIRMWARE_ROLE_UFW,
} as const;

export type Uv5rMiniWireKey = keyof typeof WIRE_TO_ROLE;
export const UV5RMINI_WIRE_KEYS = Object.keys(WIRE_TO_ROLE) as Uv5rMiniWireKey[];

/** The result image is at most 1 MiB (1,048,576 bytes). */
export const UV5RMINI_MAX_RESULT_SIZE = 1024 * 1024;
/** A patch carries at most this many edits. */
export const UV5RMINI_MAX_EDITS = 4096;

/** `build.name`, each `loader.list` entry: 1–21 printable ASCII characters, no space. */
export const UV5RMINI_BUILD_NAME_RE = /^[\x21-\x7e]{1,21}$/;
/** `build.appSize`, `build.appCrc`: `0x` and hex digits. */
export const UV5RMINI_HEX_NUMBER_RE = /^0x[0-9a-fA-F]+$/;
