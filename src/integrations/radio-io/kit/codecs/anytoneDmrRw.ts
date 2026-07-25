/**
 * Anytone DMR R/W family BlockCodec — shared framing for D890UV / D878UVII-line radios.
 *
 * Frame shape (cite anytone-cps SerialDevice; facts only):
 *   Enter: ASCII PROGRAM → QX + 0x06 (or lone 0x00)
 *   Read:  'R' + addr u32 BE + length u8
 *   Read reply: 'W' + addr u32 BE + length u8 + payload + 8-bit checksum + 0x06
 *   Write: 'W' + addr u32 BE + length u8 + payload + checksum + 0x06
 *   Write ACK: 0x06
 *
 * No model allow-list, region maps, or safe-skip addresses — those belong in radio modules (#649).
 * Baud (921600) belongs on RadioDescriptor, not here.
 */

import type { BlockCodec, BytePipe } from '../../types.ts';
import { RadioProtocolError, RadioTimeoutError } from '../errors.ts';

export const ANYTONE_DMR_ACK = 0x06;
export const ANYTONE_DMR_READ_OPCODE = 0x52; // 'R'
export const ANYTONE_DMR_WRITE_OPCODE = 0x57; // 'W'
export const ANYTONE_DMR_READ_HEADER_LEN = 6;
export const ANYTONE_DMR_WRITE_REPLY_HEADER_LEN = 6;
export const ANYTONE_DMR_BLOCK_SIZE = 0x10;

const PROGRAM_ENTER = new TextEncoder().encode('PROGRAM');
const PROGRAM_EXIT = new TextEncoder().encode('END');

function assertU32Addr(addr: number): void {
  if (!Number.isInteger(addr) || addr < 0 || addr > 0xffff_ffff) {
    throw new RangeError(`Anytone DMR address must be u32, got ${addr}`);
  }
}

function assertU8Length(length: number): void {
  if (!Number.isInteger(length) || length < 0 || length > 0xff) {
    throw new RangeError(`Anytone DMR length must be u8, got ${length}`);
  }
}

function assertBlockAligned(length: number): void {
  if (length % ANYTONE_DMR_BLOCK_SIZE !== 0) {
    throw new RangeError(
      `Anytone DMR length must be a multiple of ${ANYTONE_DMR_BLOCK_SIZE}, got ${length}`,
    );
  }
}

function putU32BE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = (value >>> 24) & 0xff;
  buf[offset + 1] = (value >>> 16) & 0xff;
  buf[offset + 2] = (value >>> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

/** 8-bit sum of bytes after the opcode (index 1 onward). */
export function anytoneDmrChecksum8AfterOpcode(bytes: Uint8Array): number {
  let sum = 0;
  for (let i = 1; i < bytes.length; i++) {
    sum = (sum + bytes[i]!) & 0xff;
  }
  return sum;
}

function makeReadHeader(addr: number, length: number): Uint8Array {
  assertU32Addr(addr);
  assertU8Length(length);
  assertBlockAligned(length);
  const frame = new Uint8Array(ANYTONE_DMR_READ_HEADER_LEN);
  frame[0] = ANYTONE_DMR_READ_OPCODE;
  putU32BE(frame, 1, addr);
  frame[5] = length & 0xff;
  return frame;
}

export function makeAnytoneDmrReadFrame(addr: number, length: number): Uint8Array {
  return makeReadHeader(addr, length);
}

export function makeAnytoneDmrWriteFrame(
  addr: number,
  length: number,
  payload: Uint8Array,
): Uint8Array {
  assertU32Addr(addr);
  assertU8Length(length);
  assertBlockAligned(length);
  if (payload.length !== length) {
    throw new RangeError(
      `Anytone DMR write payload length ${payload.length} does not match length ${length}`,
    );
  }

  const bodyLen = ANYTONE_DMR_WRITE_REPLY_HEADER_LEN + payload.length;
  const body = new Uint8Array(bodyLen);
  body[0] = ANYTONE_DMR_WRITE_OPCODE;
  putU32BE(body, 1, addr);
  body[5] = length & 0xff;
  body.set(payload, ANYTONE_DMR_WRITE_REPLY_HEADER_LEN);

  const checksum = anytoneDmrChecksum8AfterOpcode(body);
  const frame = new Uint8Array(bodyLen + 2);
  frame.set(body, 0);
  frame[bodyLen] = checksum;
  frame[bodyLen + 1] = ANYTONE_DMR_ACK;
  return frame;
}

/** Parse read reply; payload starts after the 6-byte W + u32 + length header. */
export function parseAnytoneDmrReadReply(frame: Uint8Array, expectedLength?: number): Uint8Array {
  const minLen = ANYTONE_DMR_WRITE_REPLY_HEADER_LEN + 2;
  if (frame.length < minLen) {
    throw new RadioProtocolError(`Anytone DMR read reply too short: ${frame.length} bytes`);
  }
  if (frame[0] !== ANYTONE_DMR_WRITE_OPCODE) {
    throw new RadioProtocolError(
      `Anytone DMR read reply expected opcode 0x57 ('W'), got 0x${frame[0]!.toString(16)}`,
    );
  }

  const length = frame[5]!;
  const payloadEnd = ANYTONE_DMR_WRITE_REPLY_HEADER_LEN + length;
  if (frame.length < payloadEnd + 2) {
    throw new RadioProtocolError(
      `Anytone DMR read reply length ${frame.length} too short for payload ${length}`,
    );
  }

  const checksumIndex = payloadEnd;
  const trailerIndex = payloadEnd + 1;
  if (frame[trailerIndex] !== ANYTONE_DMR_ACK) {
    throw new RadioProtocolError(
      `Anytone DMR read reply expected trailer 0x06, got 0x${frame[trailerIndex]!.toString(16)}`,
    );
  }

  const expectedChecksum = anytoneDmrChecksum8AfterOpcode(frame.subarray(0, checksumIndex));
  const actualChecksum = frame[checksumIndex]!;
  if (actualChecksum !== expectedChecksum) {
    throw new RadioProtocolError(
      `Anytone DMR read reply checksum mismatch: expected 0x${expectedChecksum.toString(16)}, got 0x${actualChecksum.toString(16)}`,
    );
  }

  const payload = frame.subarray(ANYTONE_DMR_WRITE_REPLY_HEADER_LEN, payloadEnd);
  if (expectedLength !== undefined && payload.length !== expectedLength) {
    throw new RadioProtocolError(
      `Anytone DMR read reply payload length ${payload.length} !== expected ${expectedLength}`,
    );
  }
  if (payload.length !== length) {
    throw new RadioProtocolError(
      `Anytone DMR read reply payload length ${payload.length} !== header length ${length}`,
    );
  }

  return payload.slice();
}

/**
 * Enter program mode: PROGRAM → QX + 0x06 (anytone-cps also tolerates lone 0x00).
 */
export async function enterAnytoneDmrProgramMode(
  pipe: BytePipe,
  timeoutMs: number,
): Promise<void> {
  await pipe.write(PROGRAM_ENTER);

  const first = await pipe.readExact(1, timeoutMs);
  if (first[0] === 0x00) {
    return;
  }
  if (first[0] === 0x51) {
    const rest = await pipe.readExact(2, timeoutMs);
    if (rest[0] === 0x58 && rest[1] === ANYTONE_DMR_ACK) {
      return;
    }
    throw new RadioProtocolError(
      `Anytone DMR enter expected X\\x06 after Q, got ${[...rest].map((b) => `0x${b.toString(16)}`).join(' ')}`,
    );
  }

  throw new RadioProtocolError(
    `Anytone DMR enter unexpected response: 0x${first[0]!.toString(16)}`,
  );
}

/**
 * Version probe after enter: send 0x02 and read until trailing 0x06.
 * Returns raw bytes — model/version parsing belongs in radio modules.
 */
export async function probeAnytoneDmrIdent(
  pipe: BytePipe,
  timeoutMs: number,
): Promise<Uint8Array> {
  await pipe.write(new Uint8Array([0x02]));

  const deadline = Date.now() + timeoutMs;
  const chunks: number[] = [];
  while (Date.now() < deadline) {
    const remaining = Math.max(1, deadline - Date.now());
    const byte = await pipe.readExact(1, remaining);
    chunks.push(byte[0]!);
    if (byte[0] === ANYTONE_DMR_ACK) {
      return new Uint8Array(chunks);
    }
  }

  throw new RadioTimeoutError('Timeout waiting for Anytone DMR ident reply');
}

/** Exit program mode (best-effort; no reply required). */
export async function exitAnytoneDmrProgramMode(pipe: BytePipe): Promise<void> {
  await pipe.write(PROGRAM_EXIT);
}

export const anytoneDmrRwCodec: BlockCodec = {
  name: 'anytone-dmr-rw',
  makeReadFrame: makeAnytoneDmrReadFrame,
  makeWriteFrame: makeAnytoneDmrWriteFrame,
  parseReadReply: parseAnytoneDmrReadReply,
};
