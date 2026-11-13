/**
 * Read the UV-5R Mini's radio report: the ordinary clone handshake (ident, then the read magics), then one 64-byte `R`
 * at `0xEFC0`, decoded with the clone XOR. Read-only by construction: it calls only `connect` and `readBlocks`, never
 * an upload, so no `W` frame can leave (the clone write interlock refuses `0xE000` and up besides). The radio is in
 * normal mode, not UPDATE...; the frame format is in docs/reference/radios/baofeng/uv-5r-mini/firmware.md.
 */
import {
  UV5RMINI_RADIO_REPORT_ADDRESS,
  UV5RMINI_RADIO_REPORT_LENGTH,
} from '@core/radios/baofeng/uv-5r-mini/radioReport.ts';

import type { FirmwareLinkSpec } from '../../firmware/types.ts';
import type { BytePipe } from '../../types.ts';
import { UV5R_MINI_BAUD_RATE, UV5R_MINI_BAUD_RATE_FALLBACK } from './constants.ts';
import { Uv5rMiniProtocol } from './protocol.ts';

/**
 * The normal-mode clone link for the report read: the clone's own baud rate, on the same cable as the update. The line
 * handling is the codeplug session's, exactly: DTR and RTS raised after the open (`openWebSerialPipe`'s default) and
 * the handshake's own settle. That is the normal-mode path proven on the Mini's cable without keying the radio; Studio
 * doesn't use any other line handling in normal mode.
 */
export const UV5RMINI_RADIO_REPORT_LINK: FirmwareLinkSpec = {
  baudRate: UV5R_MINI_BAUD_RATE,
  usbFilters: [{ usbVendorId: 0x1a86, usbProductId: 0x7523 }],
  raiseDtrRts: true,
};

/** The codeplug session's fallback rate, tried once when the handshake gets no answer at 115200. */
export const UV5RMINI_RADIO_REPORT_BAUD_FALLBACK = UV5R_MINI_BAUD_RATE_FALLBACK;

/** The 64 decoded bytes at `0xEFC0`. One handshake, one read. */
export async function readUv5rMiniRadioReport(
  pipe: BytePipe,
  opts: { signal?: AbortSignal; settleScale?: number } = {},
): Promise<Uint8Array> {
  const radio = new Uv5rMiniProtocol();
  try {
    await radio.connect(pipe, { signal: opts.signal, settleScale: opts.settleScale });
    const blocks = await radio.readBlocks([UV5RMINI_RADIO_REPORT_ADDRESS], {
      signal: opts.signal,
    });
    const block = blocks.get(UV5RMINI_RADIO_REPORT_ADDRESS)!;
    return block.slice(0, UV5RMINI_RADIO_REPORT_LENGTH);
  } finally {
    await radio.disconnect();
  }
}
