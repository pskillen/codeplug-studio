/**
 * PROGRAM+R/W magics after ident — UV-17Pro family.
 * Cite: CHIRP baofeng_uv17Pro.py; NeonPlug baofengProtocol.ts (Mini upload trailer).
 */

export interface Uv17ProMagicStep {
  send: Uint8Array;
  responseLen: number;
}

export interface Uv17ProMagicSet {
  read: readonly Uv17ProMagicStep[];
  upload: readonly Uv17ProMagicStep[];
}

const SEND_PREFIX = new Uint8Array([
  0x53, 0x45, 0x4e, 0x44, 0x21, 0x05, 0x0d, 0x01, 0x01, 0x01, 0x04, 0x11, 0x08, 0x05, 0x0d, 0x0d,
  0x01, 0x11, 0x0f, 0x09, 0x12, 0x09, 0x10, 0x04,
]);

/** Build read/upload magic tables; trailer byte is last byte of SEND! frame. */
export function buildUv17ProMagics(
  readTrailer: number,
  uploadTrailer: number,
): Uv17ProMagicSet {
  const sendTrailer = (trailer: number): Uint8Array => {
    const out = new Uint8Array(SEND_PREFIX.length + 1);
    out.set(SEND_PREFIX);
    out[SEND_PREFIX.length] = trailer;
    return out;
  };
  return {
    read: [
      { send: new Uint8Array([0x46]), responseLen: 16 },
      { send: new Uint8Array([0x4d]), responseLen: 15 },
      { send: sendTrailer(readTrailer), responseLen: 1 },
    ],
    upload: [
      { send: new Uint8Array([0x46]), responseLen: 16 },
      { send: new Uint8Array([0x4d]), responseLen: 15 },
      { send: sendTrailer(uploadTrailer), responseLen: 1 },
    ],
  };
}
