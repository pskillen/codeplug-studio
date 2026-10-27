/**
 * AT-D890UV NXDN own ID (MM9PDY, radio reports NXDN enabled; #1442).
 *
 * The radio has one NXDN ID: `OwnId` in the NXDN settings block (unit `0x04B00000` `+0x00`, 3-byte
 * BCD). Write read-modify-writes that erase unit and changes only these three bytes; every other
 * NXDN setting, the encryption keys and the state messages are sent back as read.
 */

import { RadioProtocolError } from '../../kit/errors.ts';
import { decodeBcdBytesBe, encodeBcdBytesBe } from './bcd.ts';
import { AT_D890_NXDN_SETTINGS } from './constants.ts';
import { eraseUnitBaseFor } from './eraseUnits.ts';
import { NXDN_ID_MAX } from './nxdnListCodec.ts';
import type { AtD890SettingsPatch } from './settingsFields.ts';

export const AT_D890_NXDN_OWN_ID_FIELD_ID = 'nxdnOwnId';
export const AT_D890_NXDN_OWN_ID_MIN = 1;
export const AT_D890_NXDN_OWN_ID_MAX = NXDN_ID_MAX;

/** Absolute address of `OwnId`. */
export const AT_D890_NXDN_OWN_ID_ADDRESS =
  AT_D890_NXDN_SETTINGS.Address + AT_D890_NXDN_SETTINGS.OwnIdOffset;

/** Erase unit that holds the NXDN settings (A half of its pair). */
export const AT_D890_NXDN_SETTINGS_UNIT_BASE = eraseUnitBaseFor(AT_D890_NXDN_SETTINGS.Address);

function assertOwnIdInRange(id: number): void {
  if (!Number.isInteger(id) || id < AT_D890_NXDN_OWN_ID_MIN || id > AT_D890_NXDN_OWN_ID_MAX) {
    throw new RadioProtocolError(
      `D890 NXDN own ID ${id} is outside ${AT_D890_NXDN_OWN_ID_MIN}–${AT_D890_NXDN_OWN_ID_MAX}`,
    );
  }
}

/** `OwnId` bytes for `id` (1234 → `00 12 34`). Throws before any frame when out of range. */
export function encodeAtD890NxdnOwnId(id: number): Uint8Array {
  assertOwnIdInRange(id);
  return encodeBcdBytesBe(id, AT_D890_NXDN_SETTINGS.OwnIdBytes);
}

/** The ID the bytes hold, or `null` when unset (all `FF`), not BCD, or out of range. */
export function decodeAtD890NxdnOwnId(bytes: Uint8Array): number | null {
  const own = bytes.subarray(0, AT_D890_NXDN_SETTINGS.OwnIdBytes);
  if (own.length < AT_D890_NXDN_SETTINGS.OwnIdBytes) return null;
  const text = Array.from(own)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (!/^\d+$/.test(text)) return null;
  const id = decodeBcdBytesBe(own);
  return id >= AT_D890_NXDN_OWN_ID_MIN && id <= AT_D890_NXDN_OWN_ID_MAX ? id : null;
}

/** The patch that sets `OwnId`: three whole bytes, nothing else in the unit. */
export function atD890NxdnOwnIdPatch(id: number): AtD890SettingsPatch {
  const patch: AtD890SettingsPatch = {
    fieldId: AT_D890_NXDN_OWN_ID_FIELD_ID,
    address: AT_D890_NXDN_OWN_ID_ADDRESS,
    bytes: encodeAtD890NxdnOwnId(id),
    mask: new Uint8Array(AT_D890_NXDN_SETTINGS.OwnIdBytes).fill(0xff),
  };
  assertAtD890NxdnOwnIdPatchPermitted(patch);
  return patch;
}

/**
 * Allow-list for the NXDN settings unit: the only bytes a Write may change there are the three
 * `OwnId` bytes, and only with an in-range BCD ID. Anything else is refused before any frame.
 */
export function assertAtD890NxdnOwnIdPatchPermitted(patch: AtD890SettingsPatch): void {
  const label = `D890 NXDN own ID patch ${patch.fieldId}`;
  if (patch.fieldId !== AT_D890_NXDN_OWN_ID_FIELD_ID) {
    throw new RadioProtocolError(`${label} is not the NXDN own ID`);
  }
  if (
    patch.address !== AT_D890_NXDN_OWN_ID_ADDRESS ||
    patch.bytes.length !== AT_D890_NXDN_SETTINGS.OwnIdBytes ||
    patch.mask.length !== AT_D890_NXDN_SETTINGS.OwnIdBytes
  ) {
    throw new RadioProtocolError(
      `${label} must be ${AT_D890_NXDN_SETTINGS.OwnIdBytes} bytes at 0x${AT_D890_NXDN_OWN_ID_ADDRESS.toString(16)}`,
    );
  }
  if (decodeAtD890NxdnOwnId(patch.bytes) === null) {
    throw new RadioProtocolError(`${label} is not an NXDN ID in BCD`);
  }
}
