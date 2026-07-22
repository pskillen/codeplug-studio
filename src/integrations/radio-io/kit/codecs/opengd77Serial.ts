/**
 * OpenGD77 / OpenUV380 USB serial framing — sibling surface (not BlockCodec).
 *
 * Message types (ASCII opcodes, not a product name):
 *   'C' Command  | 'R' Read | 'W' Write (GD-77) | 'X' Write (OpenUV380)
 *
 * Cite Studio docs/reference/radios/opengd77/protocol.md and qdmr
 * opengd77_protocol_*.txt verbincludes (facts only; do not copy GPL).
 *
 * No EEPROM/FLASH region tables or radio adapters — those stay in radios/<id>/.
 */

import { RadioProtocolError } from '../errors.ts';

export const OPENGD77_BLOCK = 32;
export const OPENGD77_SECTOR = 4096;
export const OPENGD77_CMD_OK = 0x2d; // '-'

export const OPENGD77_TYPE_COMMAND = 0x43; // 'C'
export const OPENGD77_TYPE_READ = 0x52; // 'R'
export const OPENGD77_TYPE_WRITE_GD77 = 0x57; // 'W'
export const OPENGD77_TYPE_WRITE_UV380 = 0x58; // 'X'

export const OPENGD77_PING_FLAG = 0xfe;

export const OPENGD77_WRITE_CMD_SET_SECTOR = 0x01;
export const OPENGD77_WRITE_CMD_SECTOR_BUFFER = 0x02;
export const OPENGD77_WRITE_CMD_FINISH_SECTOR = 0x03;
export const OPENGD77_WRITE_CMD_EEPROM = 0x04;

export type OpenGd77WriteVariant = 'W' | 'X';

/** Mem-region codes for 'R' requests (subset documented in protocol.md). */
export type OpenGd77MemCode = 0x01 | 0x02 | 0x05 | 0x06 | 0x07 | 0x08 | 0x09 | 0x0a;

function writeVariantByte(variant: OpenGd77WriteVariant): number {
  return variant === 'X' ? OPENGD77_TYPE_WRITE_UV380 : OPENGD77_TYPE_WRITE_GD77;
}

function assertU32(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new RangeError(`${label} must be u32, got ${value}`);
  }
}

function assertU16(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new RangeError(`${label} must be u16, got ${value}`);
  }
}

function assertU8(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new RangeError(`${label} must be u8, got ${value}`);
  }
}

function putU32BE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = (value >>> 24) & 0xff;
  buf[offset + 1] = (value >>> 16) & 0xff;
  buf[offset + 2] = (value >>> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

function putU16BE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = (value >>> 8) & 0xff;
  buf[offset + 1] = value & 0xff;
}

function getU16BE(buf: Uint8Array, offset: number): number {
  return ((buf[offset]! << 8) | buf[offset + 1]!) >>> 0;
}

// --- Command ('C') ---

/** Minimal ping: `C fe` (2 bytes). */
export function makePingFrame(): Uint8Array {
  return new Uint8Array([OPENGD77_TYPE_COMMAND, OPENGD77_PING_FLAG]);
}

/** Minimal command: `C` + flag + optional payload. */
export function makeCommandFrame(flag: number, payload?: Uint8Array): Uint8Array {
  assertU8(flag, 'OpenGD77 command flag');
  const extra = payload ?? new Uint8Array(0);
  const frame = new Uint8Array(2 + extra.length);
  frame[0] = OPENGD77_TYPE_COMMAND;
  frame[1] = flag;
  if (extra.length > 0) {
    frame.set(extra, 2);
  }
  return frame;
}

/** Command success ACK is a single `'-'` (0x2d). */
export function parseCommandAck(frame: Uint8Array): void {
  if (frame.length !== 1 || frame[0] !== OPENGD77_CMD_OK) {
    throw new RadioProtocolError(
      `OpenGD77 command expected ACK '-', got ${frame.length} byte(s) 0x${frame[0]?.toString(16) ?? '??'}`,
    );
  }
}

// --- Read ('R') ---

/** 8-byte read request: `R` + mem + addr u32 BE + length u16 BE. */
export function makeOpenGd77ReadFrame(
  mem: OpenGd77MemCode,
  addr: number,
  length: number,
): Uint8Array {
  assertU8(mem, 'OpenGD77 mem code');
  assertU32(addr, 'OpenGD77 read address');
  assertU16(length, 'OpenGD77 read length');
  const frame = new Uint8Array(8);
  frame[0] = OPENGD77_TYPE_READ;
  frame[1] = mem;
  putU32BE(frame, 2, addr);
  putU16BE(frame, 6, length);
  return frame;
}

/**
 * Parse data reply: `R` + length u16 BE + payload.
 * Length must match payload (and optional expectedLength).
 */
export function parseOpenGd77ReadReply(
  frame: Uint8Array,
  expectedLength?: number,
): Uint8Array {
  if (frame.length < 3) {
    throw new RadioProtocolError(`OpenGD77 read reply too short: ${frame.length} bytes`);
  }
  if (frame[0] !== OPENGD77_TYPE_READ) {
    throw new RadioProtocolError(
      `OpenGD77 read reply expected 'R', got 0x${frame[0]!.toString(16)}`,
    );
  }
  const length = getU16BE(frame, 1);
  const payload = frame.subarray(3);
  if (payload.length !== length) {
    throw new RadioProtocolError(
      `OpenGD77 read reply payload length ${payload.length} !== header length ${length}`,
    );
  }
  if (expectedLength !== undefined && payload.length !== expectedLength) {
    throw new RadioProtocolError(
      `OpenGD77 read reply payload length ${payload.length} !== expected ${expectedLength}`,
    );
  }
  return payload.slice();
}

// --- Write ('W' / 'X') ---

/** 5-byte set flash sector: type + 0x01 + sector u24 BE (`floor(addr/4096)`). */
export function makeSetFlashSectorFrame(
  variant: OpenGd77WriteVariant,
  addr: number,
): Uint8Array {
  assertU32(addr, 'OpenGD77 flash address');
  const sector = Math.floor(addr / OPENGD77_SECTOR);
  if (sector > 0xff_ffff) {
    throw new RangeError(`OpenGD77 flash sector index too large: ${sector}`);
  }
  const frame = new Uint8Array(5);
  frame[0] = writeVariantByte(variant);
  frame[1] = OPENGD77_WRITE_CMD_SET_SECTOR;
  frame[2] = (sector >>> 16) & 0xff;
  frame[3] = (sector >>> 8) & 0xff;
  frame[4] = sector & 0xff;
  return frame;
}

/** Write sector buffer: type + 0x02 + addr BE + len BE + payload (≤32). */
export function makeWriteSectorBufferFrame(
  variant: OpenGd77WriteVariant,
  addr: number,
  payload: Uint8Array,
): Uint8Array {
  assertU32(addr, 'OpenGD77 buffer address');
  if (payload.length === 0 || payload.length > OPENGD77_BLOCK) {
    throw new RangeError(
      `OpenGD77 sector buffer payload length must be 1..${OPENGD77_BLOCK}, got ${payload.length}`,
    );
  }
  const frame = new Uint8Array(8 + payload.length);
  frame[0] = writeVariantByte(variant);
  frame[1] = OPENGD77_WRITE_CMD_SECTOR_BUFFER;
  putU32BE(frame, 2, addr);
  putU16BE(frame, 6, payload.length);
  frame.set(payload, 8);
  return frame;
}

/** 2-byte finish flash sector: type + 0x03. */
export function makeFinishFlashSectorFrame(variant: OpenGd77WriteVariant): Uint8Array {
  return new Uint8Array([writeVariantByte(variant), OPENGD77_WRITE_CMD_FINISH_SECTOR]);
}

/** Write EEPROM: type + 0x04 + addr BE + len BE + payload (≤32). */
export function makeWriteEepromFrame(
  variant: OpenGd77WriteVariant,
  addr: number,
  payload: Uint8Array,
): Uint8Array {
  assertU32(addr, 'OpenGD77 EEPROM address');
  if (payload.length === 0 || payload.length > OPENGD77_BLOCK) {
    throw new RangeError(
      `OpenGD77 EEPROM payload length must be 1..${OPENGD77_BLOCK}, got ${payload.length}`,
    );
  }
  const frame = new Uint8Array(8 + payload.length);
  frame[0] = writeVariantByte(variant);
  frame[1] = OPENGD77_WRITE_CMD_EEPROM;
  putU32BE(frame, 2, addr);
  putU16BE(frame, 6, payload.length);
  frame.set(payload, 8);
  return frame;
}

/**
 * Write ACK: success echoes `{type, command}` (2 bytes).
 * A leading `'-'` means write error (opposite of command ACK).
 */
export function parseWriteAck(
  frame: Uint8Array,
  expectedType: OpenGd77WriteVariant,
  expectedCmd: number,
): void {
  assertU8(expectedCmd, 'OpenGD77 write command');
  if (frame.length !== 2) {
    throw new RadioProtocolError(`OpenGD77 write ACK expected 2 bytes, got ${frame.length}`);
  }
  if (frame[0] === OPENGD77_CMD_OK) {
    throw new RadioProtocolError("OpenGD77 write failed (radio returned '-')");
  }
  const expectedTypeByte = writeVariantByte(expectedType);
  if (frame[0] !== expectedTypeByte || frame[1] !== expectedCmd) {
    throw new RadioProtocolError(
      `OpenGD77 write ACK expected 0x${expectedTypeByte.toString(16)} 0x${expectedCmd.toString(16)}, got 0x${frame[0]!.toString(16)} 0x${frame[1]!.toString(16)}`,
    );
  }
}
