/**
 * Synthetic LocalInfo for range-change tests. No owner data: serial `TESTSERIAL01`, model `D890UV`.
 */

import { localInfoWithSerial } from './scriptedPipe.ts';

/** Healthy LocalInfo (`0x100` bytes): no stun/kill, market and lock `0x01`, range `code`; `890#` when unlocked. */
export function syntheticLocalInfo(code = 3, opts: { unlocked?: boolean } = {}): Uint8Array {
  const li = localInfoWithSerial('TESTSERIAL01');
  li[0x03] = code;
  li[0x04] = 0x01;
  li[0x05] = 0x01;
  li.set(new TextEncoder().encode('D890UV'), 0x10);
  if (opts.unlocked) li.set(new TextEncoder().encode('890#'), 0x0b);
  return li;
}

/** A synthetic tune bank (`length` bytes) with the range code mirrored at `+0x28`. */
export function syntheticTune(code = 3, length = 0x2000): Uint8Array {
  const t = new Uint8Array(length);
  for (let i = 0; i < length; i++) t[i] = (i * 7 + 1) & 0xff;
  t[0x28] = code;
  return t;
}
