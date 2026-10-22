/**
 * AT-D890UV bootloader data frame: `01` + addr u32 LE + 32 data bytes + sum16 LE over bytes [1, 37) + `06`.
 * Port of `frame()` in the firmware project's `tools/d890update.py`.
 */
import { RadioInterlockError } from '../../../kit/errors.ts';
import {
  AT_D890_FW_ACK,
  AT_D890_FW_BLOCK,
  AT_D890_FW_FRAME,
  AT_D890_FW_FRAME_START,
} from './constants.ts';

/** Sum of bytes [1, 37): the address and the data. */
export function d890FrameSum(frame: Uint8Array): number {
  let sum = 0;
  for (let i = 1; i < 37; i++) sum += frame[i]!;
  return sum & 0xffff;
}

export function makeD890UpdateFrame(addr: number, data32: Uint8Array): Uint8Array {
  if (data32.length !== AT_D890_FW_BLOCK) {
    throw new RadioInterlockError('A data frame carries exactly 32 bytes.');
  }
  const f = new Uint8Array(AT_D890_FW_FRAME);
  f[0] = AT_D890_FW_FRAME_START;
  f[1] = addr & 0xff;
  f[2] = (addr >>> 8) & 0xff;
  f[3] = (addr >>> 16) & 0xff;
  f[4] = (addr >>> 24) & 0xff;
  f.set(data32, 5);
  const sum = d890FrameSum(f);
  f[37] = sum & 0xff;
  f[38] = sum >>> 8;
  f[39] = AT_D890_FW_ACK;
  return f;
}

/** The frame's target address (u32 LE at byte 1). */
export function d890FrameAddr(frame: Uint8Array): number {
  return (frame[1]! | (frame[2]! << 8) | (frame[3]! << 16) | (frame[4]! << 24)) >>> 0;
}
