/**
 * Debug-link framing for the fast codeplug command.
 * RadioFoundry docs/spec/debuglink.md §2: `A5 5A | cmd | seq | len u16 LE | payload | CRC-16/CCITT-FALSE`.
 * The CRC covers the bytes from the command through the end of the payload.
 */

import { crc16CcittFalse } from '../../kit/checksums.ts';

const SOF1 = 0xa5;
const SOF2 = 0x5a;

export interface DebugFrame {
  command: number;
  seq: number;
  payload: Uint8Array;
}

export function encodeDebugFrame(command: number, seq: number, payload: Uint8Array): Uint8Array {
  if (payload.length > 1024) {
    throw new Error(`Debug-link payload is ${payload.length} bytes; the maximum is 1024.`);
  }
  const frame = new Uint8Array(8 + payload.length);
  frame[0] = SOF1;
  frame[1] = SOF2;
  frame[2] = command & 0xff;
  frame[3] = seq & 0xff;
  frame[4] = payload.length & 0xff;
  frame[5] = (payload.length >> 8) & 0xff;
  frame.set(payload, 6);
  const crc = crc16CcittFalse(frame.subarray(2, 6 + payload.length));
  frame[6 + payload.length] = crc & 0xff;
  frame[7 + payload.length] = (crc >> 8) & 0xff;
  return frame;
}

export function decodeDebugFrame(bytes: Uint8Array): DebugFrame {
  if (bytes.length < 8 || bytes[0] !== SOF1 || bytes[1] !== SOF2) {
    throw new Error('Not a debug-link frame.');
  }
  const len = bytes[4]! | (bytes[5]! << 8);
  if (len > 1024 || bytes.length !== 8 + len) {
    throw new Error('Debug-link frame length does not match its header.');
  }
  const covered = bytes.subarray(2, 6 + len);
  const crc = bytes[6 + len]! | (bytes[7 + len]! << 8);
  if (crc !== crc16CcittFalse(covered)) {
    throw new Error('Debug-link frame CRC does not match.');
  }
  return {
    command: bytes[2]!,
    seq: bytes[3]!,
    payload: bytes.slice(6, 6 + len),
  };
}
