/**
 * RadioFoundry STORAGE op 2 CLAIM payload: the only builder of `02 | token u32 LE` (exactly 5 bytes).
 */

import { RadioInterlockError } from '../../../kit/errors.ts';

export const STORAGE_OP_CLAIM = 2;

export class StorageClaimFrameRefusedError extends RadioInterlockError {
  constructor(message: string) {
    super(message);
    this.name = 'StorageClaimFrameRefusedError';
  }
}

/** Build the 5-byte STORAGE CLAIM argument (op byte is added by the sender). */
export function buildStorageClaimTokenPayload(token: number): Uint8Array {
  const buf = new Uint8Array(5);
  buf[0] = STORAGE_OP_CLAIM;
  buf[1] = token & 0xff;
  buf[2] = (token >>> 8) & 0xff;
  buf[3] = (token >>> 16) & 0xff;
  buf[4] = (token >>> 24) & 0xff;
  return buf;
}

/** Refuse before a CLAIM is sent when the payload is not exactly 5 bytes with op 2. */
export function assertStorageClaimPayload(payload: Uint8Array): void {
  if (payload.length !== 5 || payload[0] !== STORAGE_OP_CLAIM) {
    throw new StorageClaimFrameRefusedError(
      'Storage claim payload must be exactly 5 bytes starting with op 2.',
    );
  }
}
