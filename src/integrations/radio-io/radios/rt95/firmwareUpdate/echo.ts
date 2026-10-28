/**
 * The RT95 programming cable is a single-wire line: by default every byte sent comes back as an echo first. The mode
 * is detected once, at the handshake, and fixed for the session. In echo mode the echo of each frame must equal what
 * was sent; a mismatch stops the session (no automatic resend).
 */
import { RadioProtocolError } from '../../../kit/errors.ts';
import type { BytePipe } from '../../../types.ts';

export type Rt95EchoMode = 'unknown' | 'echo' | 'none';

export interface Rt95EchoChannel {
  mode(): Rt95EchoMode;
  setMode(mode: 'echo' | 'none'): void;
  /**
   * Send `frame` through the guarded send, then, in echo mode, read the echo back within `timeoutMs` and require it
   * to equal `frame`. A silent line throws RadioTimeoutError; a different echo throws RadioProtocolError.
   */
  writeChecked(frame: Uint8Array, timeoutMs: number): Promise<void>;
}

export function createEchoChannel(
  pipe: BytePipe,
  send: (frame: Uint8Array) => Promise<void>,
): Rt95EchoChannel {
  let mode: Rt95EchoMode = 'unknown';
  return {
    mode: () => mode,
    setMode: (m) => {
      mode = m;
    },
    async writeChecked(frame, timeoutMs) {
      await send(frame);
      if (mode !== 'echo') return;
      const echo = await pipe.readExact(frame.length, timeoutMs);
      for (let i = 0; i < frame.length; i++) {
        if (echo[i] !== frame[i]) {
          throw new RadioProtocolError(
            `The cable echo did not match what Studio sent (byte ${i} of ${frame.length}). Nothing more was sent. Check the cable and try again.`,
          );
        }
      }
    },
  };
}
