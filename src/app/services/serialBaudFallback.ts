/**
 * Open a serial link at each baud rate in turn and run a handshake on it, moving to the next rate only when the radio
 * didn't answer the handshake (no answer, or a wrong ident). The codeplug session and the firmware wizard's radio
 * report read both open through this, so a radio that answers only at its fallback rate is treated the same by each.
 * The caller supplies the opener, so line handling (DTR/RTS) and transport stay the caller's.
 */
import { RadioTimeoutError, RadioWrongIdentError, type BytePipe } from '@integrations/radio-io';

/** A handshake the radio didn't answer at this baud rate: worth one more try at the next. */
export function isHandshakeConnectFailure(err: unknown): boolean {
  return err instanceof RadioWrongIdentError || err instanceof RadioTimeoutError;
}

/**
 * Returns the open pipe and the handshake's result. On a failure the pipe is closed before the next rate is tried or the
 * error is thrown; an `open` failure is thrown as is. `mapError` shapes the error thrown, given the rates tried.
 */
export async function openWithBaudFallback<T>(input: {
  bauds: readonly number[];
  open: (baud: number) => Promise<BytePipe>;
  handshake: (pipe: BytePipe) => Promise<T>;
  mapError?: (err: unknown, baudsTried: readonly number[]) => unknown;
}): Promise<{ pipe: BytePipe; result: T }> {
  const { bauds, open, handshake, mapError } = input;
  for (let attempt = 0; attempt < bauds.length; attempt++) {
    const pipe = await open(bauds[attempt]!);
    try {
      return { pipe, result: await handshake(pipe) };
    } catch (err) {
      try {
        await pipe.close();
      } catch {
        /* ignore close errors before a retry or while surfacing the failure */
      }
      if (attempt === bauds.length - 1 || !isHandshakeConnectFailure(err)) {
        throw mapError ? mapError(err, bauds.slice(0, attempt + 1)) : err;
      }
    }
  }
  throw new Error('Radio connect failed unexpectedly.');
}
