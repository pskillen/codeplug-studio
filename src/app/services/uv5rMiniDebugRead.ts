/**
 * The UV-5R Mini debug page's full clone read over Web Serial. Opens and retries as the codeplug session does: DTR
 * and RTS raised after the open, and when the handshake gets no answer at 115200, once more at 38400. The read itself
 * is the integration's read-only session (its sender refuses anything but the handshake, `R` and `E`). Always closes.
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
import {
  openWebSerialPipe,
  requestWebSerialPort,
  type SerialPortLike,
} from '@integrations/radio-io/transport/index.ts';
import type { BytePipe, ProgressFn } from '@integrations/radio-io/types.ts';

import { openWithBaudFallback } from './serialBaudFallback.ts';

/** Pick the Mini's cable (CH340). Call from a user gesture. */
export async function grantUv5rMiniDebugPort(): Promise<SerialPortLike> {
  return requestWebSerialPort(true, UV5RMINI_RADIO_REPORT_LINK.usbFilters);
}

export async function runUv5rMiniDebugFullRead(input: {
  port: SerialPortLike;
  onProgress?: ProgressFn;
  signal?: AbortSignal;
  /** Tests only: scale the handshake's settle delays. */
  settleScale?: number;
  /** Tests only: open a pipe at a rate instead of the Web Serial port. */
  open?: (baud: number) => Promise<BytePipe>;
}): Promise<Uv5rMiniFullRead> {
  const { port, onProgress, signal, settleScale } = input;
  const open =
    input.open ??
    ((baud: number) =>
      openWebSerialPipe(port, baud, { raiseDtrRts: UV5RMINI_RADIO_REPORT_LINK.raiseDtrRts }));
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
      await (pipe ?? port).close();
    } catch {
      /* closing is best effort; the port may never have opened */
    }
  }
}
