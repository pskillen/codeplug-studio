/**
 * AT-D890UV connected-radio identity check (#768 phase 2).
 *
 * Refuses Write when the hydration stash serial does not match the live radio —
 * prevents replaying a stale bag onto a different handheld (incident 3.2).
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

function serialLabel(data: Uint8Array): string {
  return new TextDecoder('ascii', { fatal: false })
    .decode(serialSlice(data))
    .replace(/\0/g, '')
    .trim();
}

export function assertAtD890LocalInfoIdentity(stashed: Uint8Array, live: Uint8Array): void {
  const need = LOCAL_INFO_SERIAL_OFFSET + LOCAL_INFO_SERIAL_LENGTH;
  if (stashed.length < need || live.length < need) {
    throw new RadioProtocolError(
      `D890 LocalInfo identity check needs at least 0x${need.toString(16)} bytes`,
    );
  }
  const a = serialSlice(stashed);
  const b = serialSlice(live);
  for (let i = 0; i < LOCAL_INFO_SERIAL_LENGTH; i++) {
    if (a[i] !== b[i]) {
      throw new RadioProtocolError(
        `D890 Write refused — connected radio serial "${serialLabel(live)}" does not match hydration stash "${serialLabel(stashed)}"`,
      );
    }
  }
}
