/**
 * Parse PROGRAM→QX version blob (CHIRP VER_FORMAT).
 */

import { RadioWrongIdentError } from '../../kit/errors.ts';
import { RT95_ALLOWED_MODEL, RT95_ALLOWED_VERSION } from './constants.ts';

export interface Rt95IdentResult {
  model: string;
  version: string;
  bandlimit: number;
}

export function parseRt95IdentResponse(raw: Uint8Array): Rt95IdentResult {
  if (raw.length < 3 || raw[0] !== 0x49) {
    throw new RadioWrongIdentError('RT95 ident: expected header 0x49');
  }
  if (raw[raw.length - 1] !== 0x06) {
    throw new RadioWrongIdentError('RT95 ident: missing trailing ACK');
  }

  const body = raw.subarray(0, raw.length - 1);
  const modelBytes = body.subarray(1, 8);
  const bandlimit = body[8] ?? 0x01;
  const versionBytes = body.subarray(9, 15);

  const model = cString(modelBytes).trim();
  const version = cString(versionBytes).trim();

  if (model !== RT95_ALLOWED_MODEL || version !== RT95_ALLOWED_VERSION) {
    throw new RadioWrongIdentError(
      `RT95 model/version mismatch: expected ${RT95_ALLOWED_MODEL}/${RT95_ALLOWED_VERSION}, got ${model}/${version}`,
    );
  }

  return { model, version, bandlimit };
}

function cString(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) {
    if (b === 0x00) break;
    s += String.fromCharCode(b);
  }
  return s;
}
