/**
 * The UV-5R Mini debug page's full clone read, over Web Serial in a browser or the USB-serial plugin in the Android app.
 * The port goes through the flasher's seam (`grantFirmwareLinkPort` / `openFirmwareLinkPipe`) with the radio report
 * read's link, so both platforms open it as the codeplug session and the report read do: 115200 baud, 8N1, DTR and RTS
 * raised after the open, and when the handshake gets no answer at 115200, once more at 38400. The read itself is the
 * integration's read-only session (its sender refuses anything but the handshake, `R` and `E`). Always closes.
 */

import {
  openUv5rMiniDebugSession,
  type Uv5rMiniFullRead,
} from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';
import {
  UV5R_MINI_BAUD_RATE,
  UV5R_MINI_BAUD_RATE_FALLBACK,
} from '@integrations/radio-io/radios/uv5r-mini/constants.ts';
import { UV5RMINI_RADIO_REPORT_LINK } from '@integrations/radio-io/radios/uv5r-mini/radioReportRead.ts';
import type { BytePipe, ProgressFn } from '@integrations/radio-io/types.ts';

import {
  closeUnopenedFirmwarePort,
  grantFirmwareLinkPort,
  openFirmwareLinkPipe,
  type FirmwarePort,
} from './firmwarePort.ts';
import { openWithBaudFallback } from './serialBaudFallback.ts';

/**
 * Pick the Mini's cable (CH340): Web Serial's picker, or in the Android app the one attached device matching it. Call
 * from a user gesture.
 */
export async function grantUv5rMiniDebugPort(): Promise<FirmwarePort> {
  return grantFirmwareLinkPort(UV5RMINI_RADIO_REPORT_LINK);
}

export async function runUv5rMiniDebugFullRead(input: {
  port: FirmwarePort;
  onProgress?: ProgressFn;
  signal?: AbortSignal;
  /** Tests only: scale the handshake's settle delays. */
  settleScale?: number;
  /** Tests only: open a pipe at a rate instead of the granted port. */
  open?: (baud: number) => Promise<BytePipe>;
}): Promise<Uv5rMiniFullRead> {
  const { port, onProgress, signal, settleScale } = input;
  const open =
    input.open ?? ((baud: number) => openFirmwareLinkPipe(port, baud, UV5RMINI_RADIO_REPORT_LINK));
  let pipe: BytePipe | null = null;
  try {
    const opened = await openWithBaudFallback({
      bauds: [UV5R_MINI_BAUD_RATE, UV5R_MINI_BAUD_RATE_FALLBACK],
      open,
      handshake: (p) => openUv5rMiniDebugSession(p, { signal, settleScale }),
    });
    pipe = opened.pipe;
    const session = opened.result;
    const read = await session.readAll({ onProgress, signal });
    await session.end().catch(() => undefined);
    return read;
  } finally {
    try {
      await (pipe ? pipe.close() : closeUnopenedFirmwarePort(port));
    } catch {
      /* closing is best effort; the port may never have opened */
    }
  }
}
