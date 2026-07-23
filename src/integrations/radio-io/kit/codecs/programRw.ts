/**
 * PROGRAM + R/W family BlockCodec — shared framing for UV-17Pro-line radios.
 *
 * Frame shape (cite NeonPlug baofengProtocol / CHIRP baofeng_uv17Pro; facts only):
 *   Read:  0x52 ('R') + addr u16 BE + length u8
 *   Write: 0x57 ('W') + addr u16 BE + length u8 + payload
 *   Read reply: 4-byte header + payload
 *   ACK: 0x06
 *
 * No XOR crypt, magics, or hard-coded ident strings — those belong in radio modules (#617).
 */

import type { BlockCodec, BytePipe } from '../../types.ts';
import { RadioProtocolError, RadioTimeoutError } from '../errors.ts';

export const PROGRAM_RW_ACK = 0x06;
export const PROGRAM_RW_READ_OPCODE = 0x52; // 'R'
export const PROGRAM_RW_WRITE_OPCODE = 0x57; // 'W'
export const PROGRAM_RW_HEADER_LEN = 4;

function assertU16Addr(addr: number): void {
  if (!Number.isInteger(addr) || addr < 0 || addr > 0xffff) {
    throw new RangeError(`PROGRAM+R/W address must be u16, got ${addr}`);
  }
}

function assertU8Length(length: number): void {
  if (!Number.isInteger(length) || length < 0 || length > 0xff) {
    throw new RangeError(`PROGRAM+R/W length must be u8, got ${length}`);
  }
}

function makeHeader(opcode: number, addr: number, length: number): Uint8Array {
  assertU16Addr(addr);
  assertU8Length(length);
  const frame = new Uint8Array(PROGRAM_RW_HEADER_LEN);
  frame[0] = opcode;
  frame[1] = (addr >>> 8) & 0xff;
  frame[2] = addr & 0xff;
  frame[3] = length & 0xff;
  return frame;
}

export function makeProgramRwReadFrame(addr: number, length: number): Uint8Array {
  return makeHeader(PROGRAM_RW_READ_OPCODE, addr, length);
}

export function makeProgramRwWriteFrame(
  addr: number,
  length: number,
  payload: Uint8Array,
): Uint8Array {
  if (payload.length !== length) {
    throw new RangeError(
      `PROGRAM+R/W write payload length ${payload.length} does not match length ${length}`,
    );
  }
  const header = makeHeader(PROGRAM_RW_WRITE_OPCODE, addr, length);
  const frame = new Uint8Array(PROGRAM_RW_HEADER_LEN + payload.length);
  frame.set(header, 0);
  frame.set(payload, PROGRAM_RW_HEADER_LEN);
  return frame;
}

/** Strip 4-byte header; optional opcode check when expectedOpcode is set. */
export function parseProgramRwReadReply(frame: Uint8Array, expectedLength?: number): Uint8Array {
  if (frame.length < PROGRAM_RW_HEADER_LEN) {
    throw new RadioProtocolError(`PROGRAM+R/W read reply too short: ${frame.length} bytes`);
  }
  if (frame[0] !== PROGRAM_RW_READ_OPCODE) {
    throw new RadioProtocolError(
      `PROGRAM+R/W read reply expected opcode 0x52, got 0x${frame[0]!.toString(16)}`,
    );
  }
  const length = frame[3]!;
  const payload = frame.subarray(PROGRAM_RW_HEADER_LEN);
  if (expectedLength !== undefined && payload.length !== expectedLength) {
    throw new RadioProtocolError(
      `PROGRAM+R/W read reply payload length ${payload.length} !== expected ${expectedLength}`,
    );
  }
  if (payload.length !== length) {
    throw new RadioProtocolError(
      `PROGRAM+R/W read reply payload length ${payload.length} !== header length ${length}`,
    );
  }
  return payload.slice();
}

/** Scan buffered bytes for ACK 0x06, discarding leading junk (NeonPlug waitForByte). */
export async function waitForAckByte(pipe: BytePipe, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const remaining = Math.max(1, deadline - Date.now());
    const byte = await pipe.readExact(1, remaining);
    if (byte[0] === PROGRAM_RW_ACK) {
      return;
    }
  }
  throw new RadioTimeoutError(`Timeout waiting for ACK 0x06`);
}

/** Read one byte and require ACK 0x06. */
export async function expectAck(pipe: BytePipe, timeoutMs: number): Promise<void> {
  try {
    await waitForAckByte(pipe, timeoutMs);
  } catch (err) {
    if (err instanceof RadioTimeoutError) {
      throw new RadioProtocolError('Expected ACK 0x06, timed out');
    }
    throw err;
  }
}

/**
 * Write caller-supplied ident bytes and expect ACK.
 * Ident content is radio-specific — do not hard-code model strings here.
 */
export async function sendIdent(
  pipe: BytePipe,
  ident: Uint8Array,
  timeoutMs: number,
): Promise<void> {
  await pipe.write(ident);
  await waitForAckByte(pipe, timeoutMs);
}

export const programRwCodec: BlockCodec = {
  name: 'program-rw',
  makeReadFrame: makeProgramRwReadFrame,
  makeWriteFrame: makeProgramRwWriteFrame,
  parseReadReply: parseProgramRwReadReply,
};
