/**
 * Magics for UV-5R Mini handshake after ident.
 * Cite: NeonPlug baofengProtocol.ts — last byte of SEND! trailer differs read vs upload.
 */

/** Magics for download (3rd magic last byte 0x00). */
export const UV5R_MINI_MAGICS_READ: ReadonlyArray<{ send: Uint8Array; responseLen: number }> = [
  { send: new Uint8Array([0x46]), responseLen: 16 },
  { send: new Uint8Array([0x4d]), responseLen: 15 },
  {
    send: new Uint8Array([
      0x53, 0x45, 0x4e, 0x44, 0x21, 0x05, 0x0d, 0x01, 0x01, 0x01, 0x04, 0x11, 0x08, 0x05, 0x0d,
      0x0d, 0x01, 0x11, 0x0f, 0x09, 0x12, 0x09, 0x10, 0x04, 0x00,
    ]),
    responseLen: 1,
  },
];

/** Magics for upload (3rd magic last byte 0x01). */
export const UV5R_MINI_MAGICS_UPLOAD: ReadonlyArray<{ send: Uint8Array; responseLen: number }> = [
  { send: new Uint8Array([0x46]), responseLen: 16 },
  { send: new Uint8Array([0x4d]), responseLen: 15 },
  {
    send: new Uint8Array([
      0x53, 0x45, 0x4e, 0x44, 0x21, 0x05, 0x0d, 0x01, 0x01, 0x01, 0x04, 0x11, 0x08, 0x05, 0x0d,
      0x0d, 0x01, 0x11, 0x0f, 0x09, 0x12, 0x09, 0x10, 0x04, 0x01,
    ]),
    responseLen: 1,
  },
];
