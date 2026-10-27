/**
 * MM9PDY settings-store record: 32 bytes at `0x03500200` inside the optional-settings unit
 * (`0x03500000`). Layout from the firmware settings-store reference: bytes 0-1 magic `M6`,
 * byte 2 version, one byte per setting, byte 31 the 8-bit sum of bytes 0-30.
 *
 * Studio only reads it, never writes it: it is the one place that says whether the radio
 * reports NXDN enabled, which gates every NXDN byte of a Write.
 */

import { D890_MAP } from './constants.ts';
import { getCacheBytes, type AtD890DownloadCache } from './memory.ts';

export const MM9PDY_SETTINGS_STORE_LENGTH = 32;
const MAGIC_M = 0x4d;
const MAGIC_6 = 0x36;
/** The record layout this reader understands; any other version is treated as invalid (fail closed). */
export const MM9PDY_SETTINGS_STORE_VERSION = 1;
const OFFSET_VERSION = 2;
/** NXDN-enabled flag: 0 = off (default), 1 = enabled. */
export const MM9PDY_STORE_NXDN_ENABLED_OFFSET = 21;
const OFFSET_SUM = 31;

/** True when the 32-byte record has the magic, the known version and a matching 8-bit sum. */
export function isMm9pdySettingsStoreValid(record: Uint8Array): boolean {
  if (record.length < MM9PDY_SETTINGS_STORE_LENGTH) return false;
  if (record[0] !== MAGIC_M || record[1] !== MAGIC_6) return false;
  if (record[OFFSET_VERSION] !== MM9PDY_SETTINGS_STORE_VERSION) return false;
  let sum = 0;
  for (let i = 0; i < OFFSET_SUM; i++) sum = (sum + record[i]!) & 0xff;
  return sum === record[OFFSET_SUM];
}

/**
 * True only for a valid record whose NXDN-enabled byte (21) is 1. A blank (`FF`), corrupt or
 * short record, or any other value, is NXDN off.
 */
export function isMm9pdyNxdnEnabledInRecord(record: Uint8Array): boolean {
  return isMm9pdySettingsStoreValid(record) && record[MM9PDY_STORE_NXDN_ENABLED_OFFSET] === 1;
}

/** The gate over an in-session download cache. No cache or no store block reads as off. */
export function isAtD890Mm9pdyNxdnEnabled(cache: AtD890DownloadCache | null | undefined): boolean {
  if (!cache) return false;
  return isMm9pdyNxdnEnabledInRecord(
    getCacheBytes(cache, D890_MAP.SettingsStore, MM9PDY_SETTINGS_STORE_LENGTH),
  );
}
