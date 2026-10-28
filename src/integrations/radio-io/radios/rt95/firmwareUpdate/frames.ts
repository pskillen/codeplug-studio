/**
 * RT95 head bootloader data frame: `01` + addr u32 LE + 1,024 data bytes + sum16 LE over bytes [1, 0x404] + `06`.
 * Port of `frame()` in the firmware project's `tools/rt95update.py`.
 */
import { RadioInterlockError } from '../../../kit/errors.ts';
import {
  RT95_HEAD_FW_ACK,
  RT95_HEAD_FW_BLOCK,
  RT95_HEAD_FW_FRAME,
  RT95_HEAD_FW_FRAME_START,
} from './constants.ts';

/** Offset of the sum's low byte. The sum covers bytes 1 to 0x404 inclusive: the address and the data. */
const SUM_OFFSET = 0x405;

export function rt95FrameSum(frame: Uint8Array): number {
  let sum = 0;
  for (let i = 1; i < SUM_OFFSET; i++) sum += frame[i]!;
  return sum & 0xffff;
}

export function makeRt95UpdateFrame(addr: number, data1024: Uint8Array): Uint8Array {
  if (data1024.length !== RT95_HEAD_FW_BLOCK) {
    throw new RadioInterlockError(`A data frame carries exactly ${RT95_HEAD_FW_BLOCK} bytes.`);
  }
  const f = new Uint8Array(RT95_HEAD_FW_FRAME);
  f[0] = RT95_HEAD_FW_FRAME_START;
  f[1] = addr & 0xff;
  f[2] = (addr >>> 8) & 0xff;
  f[3] = (addr >>> 16) & 0xff;
  f[4] = (addr >>> 24) & 0xff;
  f.set(data1024, 5);
  const sum = rt95FrameSum(f);
  f[SUM_OFFSET] = sum & 0xff;
  f[SUM_OFFSET + 1] = sum >>> 8;
  f[SUM_OFFSET + 2] = RT95_HEAD_FW_ACK;
  return f;
}

/** The frame's target address (u32 LE at byte 1). */
export function rt95FrameAddr(frame: Uint8Array): number {
  return (frame[1]! | (frame[2]! << 8) | (frame[3]! << 16) | (frame[4]! << 24)) >>> 0;
}

/** The frame's stored sum (u16 LE at 0x405). */
export function rt95FrameStoredSum(frame: Uint8Array): number {
  return frame[SUM_OFFSET]! | (frame[SUM_OFFSET + 1]! << 8);
}
