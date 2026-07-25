/**
 * PROGRAM→QX family BlockCodec — shared framing for RT95 / AnyTone 778UV-line radios.
 *
 * Frame shape (cite CHIRP anytone778uv.py; facts only):
 *   Enter: ASCII PROGRAM → QX + 0x06
 *   Read:  0x52 + addr u16 BE + length u8
 *   Read reply: 4-byte header + payload + 8-bit checksum + 0x06 (22 bytes = 0x16)
 *   Write: 0x57 + addr u16 BE + length u8 + payload + checksum + trailing 0x06
 *   Write reply: 0x06 ACK or 0x0a NACK
 *
 * Echo-strip required (shared TX/RX). No model allow-list or memory layout — radio modules (#643).
 * Baud (9600) belongs on RadioDescriptor, not here.
 */

import type { BlockCodec, BytePipe } from '../../types.ts';
import { RadioProtocolError, RadioTimeoutError } from '../errors.ts';

export const PROGRAM_QX_ACK = 0x06;
export const PROGRAM_QX_NACK = 0x0a;
export const PROGRAM_QX_READ_OPCODE = 0x52; // 'R'
export const PROGRAM_QX_WRITE_OPCODE = 0x57; // 'W'
export const PROGRAM_QX_READ_HEADER_LEN = 4;
export const PROGRAM_QX_BLOCK_SIZE = 0x10;
export const PROGRAM_QX_READ_REPLY_LEN = 0x16;

const PROGRAM_ENTER = new TextEncoder().encode('PROGRAM');
const PROGRAM_EXIT = new TextEncoder().encode('END');
const DEFAULT_ECHO_TIMEOUT_MS = 500;

function assertU16Addr(addr: number): void {
  if (!Number.isInteger(addr) || addr < 0 || addr > 0xffff) {
    throw new RangeError(`PROGRAM→QX address must be u16, got ${addr}`);
  }
}

function assertU8Length(length: number): void {
  if (!Number.isInteger(length) || length < 0 || length > 0xff) {
    throw new RangeError(`PROGRAM→QX length must be u8, got ${length}`);
  }
}

function assertBlockAligned(length: number): void {
  if (length % PROGRAM_QX_BLOCK_SIZE !== 0) {
    throw new RangeError(
      `PROGRAM→QX length must be a multiple of ${PROGRAM_QX_BLOCK_SIZE}, got ${length}`,
    );
  }
}

/** 8-bit sum of bytes after the opcode (index 1 onward). */
export function programQxChecksum8AfterOpcode(bytes: Uint8Array): number {
  let sum = 0;
  for (let i = 1; i < bytes.length; i++) {
    sum = (sum + bytes[i]!) & 0xff;
  }
  return sum;
}

function makeHeader(opcode: number, addr: number, length: number): Uint8Array {
  assertU16Addr(addr);
  assertU8Length(length);
  const frame = new Uint8Array(PROGRAM_QX_READ_HEADER_LEN);
  frame[0] = opcode;
  frame[1] = (addr >>> 8) & 0xff;
  frame[2] = addr & 0xff;
  frame[3] = length & 0xff;
  return frame;
}

export function makeProgramQxReadFrame(addr: number, length: number): Uint8Array {
  assertBlockAligned(length);
  return makeHeader(PROGRAM_QX_READ_OPCODE, addr, length);
}

export function makeProgramQxWriteFrame(
  addr: number,
  length: number,
  payload: Uint8Array,
): Uint8Array {
  assertBlockAligned(length);
  if (payload.length !== length) {
    throw new RangeError(
      `PROGRAM→QX write payload length ${payload.length} does not match length ${length}`,
    );
  }

  const bodyLen = PROGRAM_QX_READ_HEADER_LEN + payload.length;
  const body = new Uint8Array(bodyLen);
  body[0] = PROGRAM_QX_WRITE_OPCODE;
  body[1] = (addr >>> 8) & 0xff;
  body[2] = addr & 0xff;
  body[3] = length & 0xff;
  body.set(payload, PROGRAM_QX_READ_HEADER_LEN);

  const checksum = programQxChecksum8AfterOpcode(body);
  const frame = new Uint8Array(bodyLen + 2);
  frame.set(body, 0);
  frame[bodyLen] = checksum;
  frame[bodyLen + 1] = PROGRAM_QX_ACK;
  return frame;
}

/**
 * Parse read reply after echo-strip.
 * CHIRP: header 4 bytes, payload, checksum, trailer 0x06.
 */
export function parseProgramQxReadReply(frame: Uint8Array, expectedLength?: number): Uint8Array {
  const minLen = PROGRAM_QX_READ_HEADER_LEN + 2;
  if (frame.length < minLen) {
    throw new RadioProtocolError(`PROGRAM→QX read reply too short: ${frame.length} bytes`);
  }

  const length = frame[3]!;
  const payloadEnd = PROGRAM_QX_READ_HEADER_LEN + length;
  if (frame.length < payloadEnd + 2) {
    throw new RadioProtocolError(
      `PROGRAM→QX read reply length ${frame.length} too short for payload ${length}`,
    );
  }

  const checksumIndex = payloadEnd;
  const trailerIndex = payloadEnd + 1;
  if (frame[trailerIndex] !== PROGRAM_QX_ACK) {
    throw new RadioProtocolError(
      `PROGRAM→QX read reply expected trailer 0x06, got 0x${frame[trailerIndex]!.toString(16)}`,
    );
  }

  const expectedChecksum = programQxChecksum8AfterOpcode(frame.subarray(0, checksumIndex));
  const actualChecksum = frame[checksumIndex]!;
  if (actualChecksum !== expectedChecksum) {
    throw new RadioProtocolError(
      `PROGRAM→QX read reply checksum mismatch: expected 0x${expectedChecksum.toString(16)}, got 0x${actualChecksum.toString(16)}`,
    );
  }

  const payload = frame.subarray(PROGRAM_QX_READ_HEADER_LEN, payloadEnd);
  if (expectedLength !== undefined && payload.length !== expectedLength) {
    throw new RadioProtocolError(
      `PROGRAM→QX read reply payload length ${payload.length} !== expected ${expectedLength}`,
    );
  }
  if (payload.length !== length) {
    throw new RadioProtocolError(
      `PROGRAM→QX read reply payload length ${payload.length} !== header length ${length}`,
    );
  }

  return payload.slice();
}

/** Strip command echo prefix when TX/RX share a pin. */
export function stripProgramQxEcho(command: Uint8Array, response: Uint8Array): Uint8Array {
  if (response.length >= command.length) {
    let matches = true;
    for (let i = 0; i < command.length; i++) {
      if (response[i] !== command[i]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return response.subarray(command.length).slice();
    }
  }
  return response.slice();
}

/**
 * Write command and read until echo-stripped reply length matches expectedReplyLen.
 * CHIRP send_serial_command semantics (~500 ms timeout).
 */
export async function sendProgramQxCommand(
  pipe: BytePipe,
  command: Uint8Array,
  expectedReplyLen: number | undefined,
  timeoutMs = DEFAULT_ECHO_TIMEOUT_MS,
): Promise<Uint8Array> {
  await pipe.write(command);
  if (pipe.flush) {
    await pipe.flush();
  }

  const deadline = Date.now() + timeoutMs;
  const chunks: number[] = [];

  while (Date.now() < deadline) {
    const remaining = Math.max(1, deadline - Date.now());
    const byte = await pipe.readExact(1, remaining);
    chunks.push(byte[0]!);

    const raw = new Uint8Array(chunks);
    const replyLen = raw.length - command.length;
    if (expectedReplyLen !== undefined && replyLen === expectedReplyLen) {
      return stripProgramQxEcho(command, raw);
    }
    if (expectedReplyLen === undefined && raw.length > command.length) {
      return stripProgramQxEcho(command, raw);
    }
  }

  throw new RadioTimeoutError(
    expectedReplyLen !== undefined
      ? `Timeout waiting for PROGRAM→QX reply (${expectedReplyLen} bytes after echo)`
      : 'Timeout waiting for PROGRAM→QX reply',
  );
}

/** Enter program mode: PROGRAM → QX + 0x06 (after echo-strip). */
export async function enterProgramQxMode(
  pipe: BytePipe,
  timeoutMs = DEFAULT_ECHO_TIMEOUT_MS,
): Promise<void> {
  const reply = await sendProgramQxCommand(pipe, PROGRAM_ENTER, 3, timeoutMs);
  if (
    reply.length !== 3 ||
    reply[0] !== 0x51 ||
    reply[1] !== 0x58 ||
    reply[2] !== PROGRAM_QX_ACK
  ) {
    throw new RadioProtocolError(
      `PROGRAM→QX enter expected QX\\x06, got ${[...reply].map((b) => `0x${b.toString(16)}`).join(' ')}`,
    );
  }
}

/**
 * Version probe after enter: send 0x02 and read until trailing 0x06.
 * Returns raw bytes — model/version parsing belongs in radio modules.
 */
export async function probeProgramQxIdent(
  pipe: BytePipe,
  timeoutMs = DEFAULT_ECHO_TIMEOUT_MS,
): Promise<Uint8Array> {
  const identCmd = new Uint8Array([0x02]);
  await pipe.write(identCmd);
  if (pipe.flush) {
    await pipe.flush();
  }

  const deadline = Date.now() + timeoutMs;
  const chunks: number[] = [];
  while (Date.now() < deadline) {
    const remaining = Math.max(1, deadline - Date.now());
    const byte = await pipe.readExact(1, remaining);
    chunks.push(byte[0]!);
    const raw = new Uint8Array(chunks);
    const stripped = stripProgramQxEcho(identCmd, raw);
    if (stripped.length > 0 && stripped[stripped.length - 1] === PROGRAM_QX_ACK) {
      return stripped.slice();
    }
  }

  throw new RadioTimeoutError('Timeout waiting for PROGRAM→QX ident reply');
}

/** Expect single-byte write ACK (0x06) or throw on NACK (0x0a). */
export function parseProgramQxWriteAck(byte: number): void {
  if (byte === PROGRAM_QX_ACK) {
    return;
  }
  if (byte === PROGRAM_QX_NACK) {
    throw new RadioProtocolError('PROGRAM→QX write NACK (0x0a)');
  }
  throw new RadioProtocolError(
    `PROGRAM→QX write expected ACK 0x06, got 0x${byte.toString(16)}`,
  );
}

/** Exit program mode (best-effort; no reply required). */
export async function exitProgramQxMode(pipe: BytePipe): Promise<void> {
  await pipe.write(PROGRAM_EXIT);
}

export const programQxCodec: BlockCodec = {
  name: 'program-qx',
  makeReadFrame: makeProgramQxReadFrame,
  makeWriteFrame: makeProgramQxWriteFrame,
  parseReadReply: parseProgramQxReadReply,
};
