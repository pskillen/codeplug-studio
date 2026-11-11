/**
 * The UV-5R Mini updater's outgoing allow-list. Everything the host writes goes through `createGuardedSend` with this
 * as the check, so nothing but these frames can leave:
 *
 * - cmd 6, empty (the ping);
 * - cmd 1 carrying exactly the app rate or the loader rate;
 * - cmd 2 carrying `{off, len}` and exactly `image[off, off+len)`, `len` at most 0x1000, inside the image;
 * - cmd 3 or cmd 4 carrying exactly what the radio's last frame of that command carried (the echo).
 *
 * The host never originates a result, a length or any other command; the radio decides those and the host only
 * repeats them back. A frame must be whole (no bytes after it) and CRC-good.
 */
import { RadioInterlockError } from '../../../kit/errors.ts';
import { crc16Xmodem } from '../../dm32uv/firmwareUpdate/crc16Xmodem.ts';
import {
  UV5RMINI_FW_APP_BAUD,
  UV5RMINI_FW_CMD,
  UV5RMINI_FW_LOADER_BAUD,
  UV5RMINI_FW_MAX_DATA,
  uv5rMiniReadU32,
} from './frames.ts';

export interface Uv5rMiniOutgoingContext {
  /** The checked image the data replies are cut from. */
  readonly image: Uint8Array;
  /** The data of the radio's last good frame of this command, if it sent one. A `Uv5rMiniSession` is one. */
  lastRadioData(cmd: number): Uint8Array | undefined;
}

const refuse = (why: string): never => {
  throw new RadioInterlockError(`UV-5R Mini updater: refusing to send ${why}.`);
};

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);

export function checkUv5rMiniOutgoing(frame: Uint8Array, ctx: Uv5rMiniOutgoingContext): void {
  if (frame.length < 7 || frame[0] !== 0xaa || frame[1] !== 0x55)
    refuse('bytes that are not a frame');
  const len = frame[2]! | (frame[3]! << 8);
  if (len < 1 || frame.length !== len + 6)
    refuse('a frame whose length field does not match its size');
  const crc = frame[frame.length - 2]! | (frame[frame.length - 1]! << 8);
  if (crc !== crc16Xmodem(frame.subarray(0, frame.length - 2))) refuse('a frame with a bad CRC');
  const cmd = frame[4]!;
  const data = frame.subarray(5, frame.length - 2);

  switch (cmd) {
    case UV5RMINI_FW_CMD.PING:
      if (data.length !== 0) refuse('a ping with data');
      return;
    case UV5RMINI_FW_CMD.BAUD: {
      const ok =
        data.length === 4 &&
        (uv5rMiniReadU32(data) === UV5RMINI_FW_APP_BAUD ||
          uv5rMiniReadU32(data) === UV5RMINI_FW_LOADER_BAUD);
      if (!ok) refuse('a rate other than the two the radio uses');
      return;
    }
    case UV5RMINI_FW_CMD.DATA: {
      if (data.length < 8) refuse('a data reply without its offset and length');
      const off = uv5rMiniReadU32(data, 0);
      const n = uv5rMiniReadU32(data, 4);
      if (n > UV5RMINI_FW_MAX_DATA) refuse('a data reply over the size limit');
      if (off + n > ctx.image.length) refuse('a data reply outside the image');
      if (data.length !== 8 + n || !sameBytes(data.subarray(8), ctx.image.subarray(off, off + n))) {
        refuse('a data reply that is not the image bytes it names');
      }
      return;
    }
    case UV5RMINI_FW_CMD.RESULT:
    case UV5RMINI_FW_CMD.LENGTH: {
      const last = ctx.lastRadioData(cmd);
      if (!last || !sameBytes(data, last))
        refuse(`a cmd ${cmd} that is not an echo of the radio's`);
      return;
    }
    default:
      refuse(`cmd ${cmd}`);
  }
}
