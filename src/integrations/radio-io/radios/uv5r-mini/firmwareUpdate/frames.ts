/**
 * UV-5R Mini firmware update frames: `AA 55 | len u16 LE | cmd u8 | data | crc u16 LE`, where `len` = 1 + data length
 * and the CRC is CRC-16/XMODEM over every byte before it. The same framing runs in the radio's own app and in the
 * update loader. Port of `frame()` and `FrameParser` in the firmware project's host tool.
 */
import { crc16Xmodem } from '../../dm32uv/firmwareUpdate/crc16Xmodem.ts';

/** The five commands. The host only ever sends these. */
export const UV5RMINI_FW_CMD = {
  /** Rate negotiation (and the app's pong / the loader's hello). */
  BAUD: 1,
  /** `{off u32 LE, len u32 LE}` from the radio; the host answers with the same plus the image bytes. */
  DATA: 2,
  /** `{code u8}`: the result. */
  RESULT: 3,
  /** `{len u32 LE}`: the loader's area length, announced just before it erases. */
  LENGTH: 4,
  /** Host to radio, empty: is the app there. */
  PING: 6,
} as const;

/** The rate the stock app's update stage runs at. */
export const UV5RMINI_FW_APP_BAUD = 9600;
/** The rate the loader runs at once it has been told to switch. No other rate is ever offered. */
export const UV5RMINI_FW_LOADER_BAUD = 38400;
/** The largest read the host will answer (the outgoing guard refuses more). */
export const UV5RMINI_FW_MAX_DATA = 0x1000;

const SYNC0 = 0xaa;
const SYNC1 = 0x55;
/** Sync (2) + len (2) + cmd (1) + crc (2): the bytes around the data. */
const FRAME_OVERHEAD = 7;

export function uv5rMiniU32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value >>> 0, true);
  return out;
}

export function uv5rMiniReadU32(data: Uint8Array, at = 0): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(at, true);
}

/** One whole frame. `data` may be empty; the longest is 0xFFFE bytes (the u16 length holds `1 + data.length`). */
export function encodeUv5rMiniFrame(cmd: number, data: Uint8Array = new Uint8Array(0)): Uint8Array {
  if (data.length > 0xfffe) throw new RangeError('A frame carries at most 65534 data bytes.');
  const out = new Uint8Array(FRAME_OVERHEAD + data.length);
  out[0] = SYNC0;
  out[1] = SYNC1;
  const len = 1 + data.length;
  out[2] = len & 0xff;
  out[3] = len >>> 8;
  out[4] = cmd & 0xff;
  out.set(data, 5);
  const crc = crc16Xmodem(out.subarray(0, 5 + data.length));
  out[5 + data.length] = crc & 0xff;
  out[6 + data.length] = crc >>> 8;
  return out;
}

export type Uv5rMiniParsed =
  { kind: 'frame'; cmd: number; data: Uint8Array } | { kind: 'bad-crc'; hex: string };

const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/** Bytes in, frames out. Anything before `AA 55` is dropped; a frame whose CRC fails is reported, never used. */
export class Uv5rMiniFrameParser {
  private buf: number[] = [];

  feed(bytes: Uint8Array): Uv5rMiniParsed[] {
    const out: Uv5rMiniParsed[] = [];
    for (const b of bytes) this.buf.push(b);
    for (;;) {
      let i = -1;
      for (let k = 0; k + 1 < this.buf.length; k++) {
        if (this.buf[k] === SYNC0 && this.buf[k + 1] === SYNC1) {
          i = k;
          break;
        }
      }
      if (i < 0) {
        // Keep a trailing 0xAA: it may be the first half of the next sync.
        this.buf = this.buf.length > 0 && this.buf[this.buf.length - 1] === SYNC0 ? [SYNC0] : [];
        return out;
      }
      if (i > 0) this.buf.splice(0, i);
      if (this.buf.length < 4) return out;
      const len = this.buf[2]! | (this.buf[3]! << 8);
      if (len === 0) {
        // No room for a command byte: not a frame. Report it and look for the next sync after this one.
        out.push({ kind: 'bad-crc', hex: toHex(Uint8Array.from(this.buf.splice(0, 2))) });
        continue;
      }
      const total = len + FRAME_OVERHEAD - 1;
      if (this.buf.length < total) return out;
      const frame = Uint8Array.from(this.buf.splice(0, total));
      const crc = frame[total - 2]! | (frame[total - 1]! << 8);
      if (crc !== crc16Xmodem(frame.subarray(0, total - 2))) {
        out.push({ kind: 'bad-crc', hex: toHex(frame) });
      } else {
        out.push({ kind: 'frame', cmd: frame[4]!, data: frame.slice(5, total - 2) });
      }
    }
  }
}
