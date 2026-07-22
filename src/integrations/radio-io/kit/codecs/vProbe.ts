/**
 * V-probe framing — sibling surface (not BlockCodec).
 *
 * Request:  0x56 ('V') + param u32 BE (5 bytes)
 * Reply:    0x56 + id + length + payload
 *
 * Cite NeonPlug dm32uv queryVFrame / CHIRP baofeng_uv17 (facts only).
 * No frame-id catalog, handshake magics, or discovery loops — those stay in radios/<id>/.
 */

import type { BytePipe } from '../../types.ts';
import { RadioProtocolError } from '../errors.ts';

export const V_PROBE_OPCODE = 0x56;
export const V_PROBE_REQUEST_LEN = 5;
export const V_PROBE_REPLY_HEADER_LEN = 3;

export interface VProbeReply {
  id: number;
  payload: Uint8Array;
}

function assertU32(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new RangeError(`${label} must be u32, got ${value}`);
  }
}

/** Build a V-probe request: `[0x56, …param BE]`. */
export function makeVProbeFrame(paramU32: number): Uint8Array {
  assertU32(paramU32, 'V-probe param');
  const frame = new Uint8Array(V_PROBE_REQUEST_LEN);
  frame[0] = V_PROBE_OPCODE;
  frame[1] = (paramU32 >>> 24) & 0xff;
  frame[2] = (paramU32 >>> 16) & 0xff;
  frame[3] = (paramU32 >>> 8) & 0xff;
  frame[4] = paramU32 & 0xff;
  return frame;
}

/** Common NeonPlug shape: probe id in the low byte (`56 00 00 00 id`). */
export function makeVInfoProbeFrame(frameId: number): Uint8Array {
  if (!Number.isInteger(frameId) || frameId < 0 || frameId > 0xff) {
    throw new RangeError(`V-probe frameId must be u8, got ${frameId}`);
  }
  return makeVProbeFrame(frameId & 0xff);
}

/** Parse `[0x56, id, len, …payload]`; length must match payload. */
export function parseVProbeReply(frame: Uint8Array): VProbeReply {
  if (frame.length < V_PROBE_REPLY_HEADER_LEN) {
    throw new RadioProtocolError(`V-probe reply too short: ${frame.length} bytes`);
  }
  if (frame[0] !== V_PROBE_OPCODE) {
    throw new RadioProtocolError(
      `V-probe reply expected opcode 0x56, got 0x${frame[0]!.toString(16)}`,
    );
  }
  const id = frame[1]!;
  const length = frame[2]!;
  const payload = frame.subarray(V_PROBE_REPLY_HEADER_LEN);
  if (payload.length !== length) {
    throw new RadioProtocolError(
      `V-probe reply payload length ${payload.length} !== header length ${length}`,
    );
  }
  return { id, payload: payload.slice() };
}

/** Parse 8-byte start/end address range (2× u32 LE). */
export function parseVAddrRange(payload: Uint8Array): { start: number; end: number } {
  if (payload.length < 8) {
    throw new RadioProtocolError(`V-probe addr range needs 8 bytes, got ${payload.length}`);
  }
  return {
    start: parseVU32LE(payload, 0),
    end: parseVU32LE(payload, 4),
  };
}

export function parseVU32LE(payload: Uint8Array, offset = 0): number {
  if (payload.length < offset + 4) {
    throw new RadioProtocolError(
      `V-probe u32LE needs 4 bytes at ${offset}, have ${payload.length}`,
    );
  }
  return (
    (payload[offset]! |
      (payload[offset + 1]! << 8) |
      (payload[offset + 2]! << 16) |
      (payload[offset + 3]! << 24)) >>>
    0
  );
}

/** Trim trailing NULs from an ASCII payload. */
export function parseVAscii(payload: Uint8Array): string {
  let end = payload.length;
  while (end > 0 && payload[end - 1] === 0) {
    end -= 1;
  }
  return new TextDecoder('ascii', { fatal: false }).decode(payload.subarray(0, end));
}

/**
 * Write a V-probe request and read the typed reply (3-byte header + N payload).
 */
export async function exchangeVProbe(
  pipe: BytePipe,
  paramU32: number,
  timeoutMs: number,
): Promise<VProbeReply> {
  await pipe.write(makeVProbeFrame(paramU32));
  const header = await pipe.readExact(V_PROBE_REPLY_HEADER_LEN, timeoutMs);
  if (header[0] !== V_PROBE_OPCODE) {
    throw new RadioProtocolError(
      `V-probe reply expected opcode 0x56, got 0x${header[0]?.toString(16) ?? '??'}`,
    );
  }
  const length = header[2]!;
  const payload = length > 0 ? await pipe.readExact(length, timeoutMs) : new Uint8Array(0);
  const frame = new Uint8Array(V_PROBE_REPLY_HEADER_LEN + payload.length);
  frame.set(header, 0);
  frame.set(payload, V_PROBE_REPLY_HEADER_LEN);
  return parseVProbeReply(frame);
}
