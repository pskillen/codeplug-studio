/**
 * AT-D890UV connected-radio identity — LocalInfo serial field (#768, #875, #1276).
 *
 * Write refuses erased LocalInfo serial ({@link assertAtD890LocalInfoPlausible}).
 * Restore compares zip vs live serial ({@link formatAtD890LocalInfoSerial}).
 * Write does not stash-compare or ask the operator to confirm serial.
 */

import { RadioProtocolError } from '../../kit/errors.ts';

/** LocalInfo serial number field — see retainPreview LOCAL_INFO_FIELD_HINTS. */
export const LOCAL_INFO_SERIAL_OFFSET = 0x30;
export const LOCAL_INFO_SERIAL_LENGTH = 0x10;

function serialSlice(data: Uint8Array): Uint8Array {
  return data.subarray(
    LOCAL_INFO_SERIAL_OFFSET,
    LOCAL_INFO_SERIAL_OFFSET + LOCAL_INFO_SERIAL_LENGTH,
  );
}

/** Human-readable serial from a LocalInfo span (empty when erased or unreadable). */
export function formatAtD890LocalInfoSerial(data: Uint8Array): string {
  const need = LOCAL_INFO_SERIAL_OFFSET + LOCAL_INFO_SERIAL_LENGTH;
  if (data.length < need) return '';
  return new TextDecoder('ascii', { fatal: false })
    .decode(serialSlice(data))
    .replace(/\0/g, '')
    .replace(/\u00ff/g, '')
    .trim();
}

export function assertAtD890LocalInfoPlausible(live: Uint8Array): void {
  const need = LOCAL_INFO_SERIAL_OFFSET + LOCAL_INFO_SERIAL_LENGTH;
  if (live.length < need) {
    throw new RadioProtocolError(
      `D890 LocalInfo identity check needs at least 0x${need.toString(16)} bytes`,
    );
  }
  const serial = serialSlice(live);
  if (serial.every((b) => b === 0xff)) {
    throw new RadioProtocolError(
      'D890 Write refused — LocalInfo serial reads erased; initialise the radio with vendor CPS before Write',
    );
  }
}
