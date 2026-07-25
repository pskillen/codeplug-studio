/**
 * Magics for UV-5R Mini handshake after ident.
 * Cite: NeonPlug baofengProtocol.ts — last byte of SEND! trailer differs read vs upload.
 */

import { UV5R_MINI_LAYOUT } from '../uv17pro-family/layout.ts';

/** Magics for download (3rd magic last byte 0x00). */
export const UV5R_MINI_MAGICS_READ = UV5R_MINI_LAYOUT.magics.read;

/** Magics for upload (3rd magic last byte 0x01). */
export const UV5R_MINI_MAGICS_UPLOAD = UV5R_MINI_LAYOUT.magics.upload;
