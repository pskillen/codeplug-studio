/**
 * Tells a radio running RadioFoundry from one running OpenGD77, during the OpenGD77 handshake.
 * RadioFoundry answers a debug-link PING (docs/spec/debuglink.md §1-3 at 454a5b76); OpenGD77 answers an unknown
 * frame type with '-' (usb_com.c:972-976; docs/reference/radios/opengd77/protocol.md). Reads and writes no memory.
 */
import { decodeDebugFrame, encodeDebugFrame } from '../../kit/codecs/radioFoundryDebugLink.ts';
import type { BytePipe } from '../../types.ts';

const PING = 0x01;
const PING_REPLY = PING | 0x80;

/** The one probe frame: PING, seq 1, empty payload (8 bytes). The debug guard matches it byte for byte. */
export const OPENGD77_RADIOFOUNDRY_PROBE_FRAME: Uint8Array = encodeDebugFrame(
  PING,
  0x01,
  new Uint8Array(0),
);

/** How long the probe waits for the first reply byte. */
export const OPENGD77_RADIOFOUNDRY_PROBE_WAIT_MS = 500;

export const OPENGD77_RADIOFOUNDRY_REFUSAL =
  'This radio is running RadioFoundry, not OpenGD77. Studio will not write it as an OpenGD77 radio. Make a build for the RadioFoundry version of this radio and write that instead.';

/** True only when the radio answers the probe with a RadioFoundry PING reply. Never throws. */
export async function probeRadioFoundry(
  pipe: BytePipe,
  waitMs: number = OPENGD77_RADIOFOUNDRY_PROBE_WAIT_MS,
): Promise<boolean> {
  try {
    await clear(pipe);
    await pipe.write(OPENGD77_RADIOFOUNDRY_PROBE_FRAME);
    const first = (await pipe.readExact(1, waitMs))[0];
    if (first !== 0xa5) return false;
    const second = (await pipe.readExact(1, waitMs))[0];
    if (second !== 0x5a) return false;
    const head = await pipe.readExact(4, waitMs); // cmd, seq, len lo, len hi
    const len = head[2]! | (head[3]! << 8);
    if (len > 1024) return false;
    const rest = await pipe.readExact(len + 2, waitMs); // payload + CRC
    const frame = new Uint8Array(6 + len + 2);
    frame[0] = 0xa5;
    frame[1] = 0x5a;
    frame.set(head, 2);
    frame.set(rest, 6);
    return decodeDebugFrame(frame).command === PING_REPLY;
  } catch {
    return false;
  } finally {
    await clear(pipe).catch(() => undefined);
  }
}

async function clear(pipe: BytePipe): Promise<void> {
  if (pipe.drain) await pipe.drain();
  else if (pipe.flush) await pipe.flush();
}
