/**
 * DM-32UV handshake, V-probe, PROGRAM entry, and 4KB block R/W.
 * Discovery loops stay in memory.ts / protocol.ts — not in kit.
 * Cite: NeonPlug dm32uv/connection.ts (facts only).
 */

import type { BytePipe } from '../../types.ts';
import {
  exchangeVProbe,
  parseVAddrRange,
  parseVAscii,
  type VProbeReply,
} from '../../kit/codecs/vProbe.ts';
import { RadioProtocolError, RadioWrongIdentError } from '../../kit/errors.ts';
import { throwIfAborted } from '../../kit/progress.ts';
import { DM32_BLOCK_SIZE, DM32_CONNECTION, DM32_METADATA_OFFSET } from './constants.ts';

const TE = new TextEncoder();
const TD = new TextDecoder('ascii', { fatal: false });

export interface Dm32SettleOptions {
  /** Multiply NeonPlug settle delays (tests use 0). Default 1. */
  settleScale?: number;
  signal?: AbortSignal;
}

function scaledMs(baseMs: number, scale: number): number {
  if (scale <= 0) return 0;
  return Math.round(baseMs * scale);
}

async function delay(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  if (ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(t);
      reject(signal?.reason ?? new Error('aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
  throwIfAborted(signal);
}

function encodeAscii(cmd: string): Uint8Array {
  return TE.encode(cmd);
}

function isDm32ModelString(s: string): boolean {
  return s.includes('DP570') || s.includes('DM32') || s.includes('DM-32');
}

export function makeDm32ReadFrame(address: number, length: number): Uint8Array {
  if (!Number.isInteger(address) || address < 0 || address > 0xff_ffff) {
    throw new RangeError(`DM-32 read address must be 24-bit, got ${address}`);
  }
  if (!Number.isInteger(length) || length < 1 || length > 0xffff) {
    throw new RangeError(`DM-32 read length must be u16, got ${length}`);
  }
  return new Uint8Array([
    0x52,
    address & 0xff,
    (address >>> 8) & 0xff,
    (address >>> 16) & 0xff,
    length & 0xff,
    (length >>> 8) & 0xff,
  ]);
}

export function makeDm32WriteFrame(address: number, data: Uint8Array): Uint8Array {
  if (data.length !== DM32_BLOCK_SIZE) {
    throw new RangeError(`DM-32 write requires ${DM32_BLOCK_SIZE} bytes, got ${data.length}`);
  }
  if (address % DM32_BLOCK_SIZE !== 0) {
    throw new RangeError(`DM-32 write address must be 4KB-aligned, got 0x${address.toString(16)}`);
  }
  const frame = new Uint8Array(6 + DM32_BLOCK_SIZE);
  frame[0] = 0x57;
  frame[1] = address & 0xff;
  frame[2] = (address >>> 8) & 0xff;
  frame[3] = (address >>> 16) & 0xff;
  frame[4] = 0x00;
  frame[5] = 0x10;
  frame.set(data, 6);
  return frame;
}

/**
 * ASCII handshake: PSEARCH → PASSSTA → SYSINFO.
 * Returns model hint string from PSEARCH payload.
 */
export async function dm32AsciiHandshake(
  pipe: BytePipe,
  opts?: Dm32SettleOptions,
): Promise<{ modelString: string }> {
  const scale = opts?.settleScale ?? 1;
  const signal = opts?.signal;
  const t = DM32_CONNECTION.TIMEOUT.HANDSHAKE_MS;

  await delay(scaledMs(DM32_CONNECTION.INIT_DELAY_MS, scale), signal);
  // Best-effort flush: nothing to read yet on a clean pipe.
  await delay(scaledMs(DM32_CONNECTION.CLEAR_BUFFER_DELAY_MS, scale), signal);

  await pipe.write(encodeAscii('PSEARCH'));
  await delay(scaledMs(DM32_CONNECTION.PSEARCH_READ_DELAY_MS, scale), signal);
  const psearch = await pipe.readExact(8, t);
  if (psearch[0] !== 0x06) {
    throw new RadioWrongIdentError(
      `DM-32UV PSEARCH expected ACK 0x06, got 0x${psearch[0]?.toString(16) ?? '??'}`,
    );
  }
  const modelString = TD.decode(psearch.subarray(1)).replace(/\0/g, '').trim();
  if (!isDm32ModelString(modelString)) {
    throw new RadioWrongIdentError(
      `Unsupported radio model "${modelString}" — expected DP570UV / DM-32UV`,
    );
  }

  await delay(scaledMs(DM32_CONNECTION.INTER_CMD_DELAY_MS, scale), signal);
  await pipe.write(encodeAscii('PASSSTA'));
  await delay(scaledMs(DM32_CONNECTION.INTER_CMD_DELAY_MS, scale), signal);
  const passsta = await pipe.readExact(3, t);
  if (passsta[0] !== 0x50) {
    throw new RadioProtocolError(
      `PASSSTA expected 0x50, got 0x${passsta[0]?.toString(16) ?? '??'}`,
    );
  }

  await delay(scaledMs(DM32_CONNECTION.INTER_CMD_DELAY_MS, scale), signal);
  await pipe.write(encodeAscii('SYSINFO'));
  await delay(scaledMs(DM32_CONNECTION.INTER_CMD_DELAY_MS, scale), signal);
  const sysinfo = await pipe.readExact(1, t);
  if (sysinfo[0] !== 0x06) {
    throw new RadioProtocolError(
      `SYSINFO expected ACK 0x06, got 0x${sysinfo[0]?.toString(16) ?? '??'}`,
    );
  }

  return { modelString };
}

/** Query one V-frame via kit exchange (NeonPlug `56 00 00 00 id` shape). */
export async function dm32QueryVFrame(
  pipe: BytePipe,
  frameId: number,
  opts?: Dm32SettleOptions,
): Promise<VProbeReply> {
  const scale = opts?.settleScale ?? 1;
  throwIfAborted(opts?.signal);
  const reply = await exchangeVProbe(pipe, frameId & 0xff, DM32_CONNECTION.TIMEOUT.VFRAME_MS);
  if (reply.id !== frameId) {
    throw new RadioProtocolError(
      `V-frame id mismatch: expected 0x${frameId.toString(16)}, got 0x${reply.id.toString(16)}`,
    );
  }
  await delay(scaledMs(DM32_CONNECTION.INTER_CMD_DELAY_MS, scale), opts?.signal);
  return reply;
}

export async function dm32EnterProgrammingMode(
  pipe: BytePipe,
  opts?: Dm32SettleOptions,
): Promise<void> {
  const scale = opts?.settleScale ?? 1;
  const t = DM32_CONNECTION.TIMEOUT.HANDSHAKE_MS;
  const program = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0x0c, ...encodeAscii('PROGRAM')]);
  await pipe.write(program);
  const ack1 = await pipe.readExact(1, t);
  if (ack1[0] !== 0x06) {
    throw new RadioProtocolError('PROGRAM command failed (expected ACK 0x06)');
  }
  await delay(scaledMs(10, scale), opts?.signal);

  await pipe.write(new Uint8Array([0x02]));
  const mode02 = await pipe.readExact(8, t);
  if (!mode02.every((b) => b === 0xff)) {
    throw new RadioProtocolError('PROGRAM mode 0x02 failed (expected 8×0xFF)');
  }
  await delay(scaledMs(10, scale), opts?.signal);

  await pipe.write(new Uint8Array([0x06]));
  const ack2 = await pipe.readExact(1, t);
  if (ack2[0] !== 0x06) {
    throw new RadioProtocolError('PROGRAM final ACK failed');
  }
  await delay(scaledMs(10, scale), opts?.signal);
}

export async function dm32ReadMemory(
  pipe: BytePipe,
  address: number,
  length: number,
  opts?: Dm32SettleOptions,
): Promise<Uint8Array> {
  const scale = opts?.settleScale ?? 1;
  throwIfAborted(opts?.signal);
  await pipe.write(makeDm32ReadFrame(address, length));
  await delay(scaledMs(25, scale), opts?.signal);
  const header = await pipe.readExact(6, DM32_CONNECTION.TIMEOUT.READ_MEMORY_MS);
  if (header[0] !== 0x57) {
    throw new RadioProtocolError(
      `Read reply expected 0x57 at 0x${address.toString(16)}, got 0x${header[0]?.toString(16) ?? '??'}`,
    );
  }
  const responseLength = header[4]! | (header[5]! << 8);
  if (responseLength === 0 || responseLength > length) {
    throw new RadioProtocolError(
      `Invalid read length ${responseLength} (requested ${length}) at 0x${address.toString(16)}`,
    );
  }
  const data = await pipe.readExact(responseLength, DM32_CONNECTION.TIMEOUT.READ_MEMORY_MS);
  await delay(scaledMs(30, scale), opts?.signal);
  return data;
}

export async function dm32WriteMemory(
  pipe: BytePipe,
  address: number,
  data: Uint8Array,
  opts?: Dm32SettleOptions,
): Promise<void> {
  const scale = opts?.settleScale ?? 1;
  throwIfAborted(opts?.signal);
  await pipe.write(makeDm32WriteFrame(address, data));
  const response = await pipe.readExact(1, DM32_CONNECTION.TIMEOUT.WRITE_MEMORY_MS);
  if (response[0] !== 0x06) {
    throw new RadioProtocolError(
      `Write not ACKed at 0x${address.toString(16)}: got 0x${response[0]?.toString(16) ?? '??'}`,
    );
  }
  await delay(scaledMs(DM32_CONNECTION.BLOCK_READ_DELAY_MS, scale), opts?.signal);
}

export function parseFirmwareFromVFrames(frames: Map<number, Uint8Array>): string | undefined {
  const fw = frames.get(0x01);
  if (!fw || fw.length === 0) return undefined;
  const text = parseVAscii(fw).trim();
  return text.length > 0 ? text : undefined;
}

export function parseConfigRangeFromV0a(payload: Uint8Array): { start: number; end: number } {
  return parseVAddrRange(payload);
}

export { DM32_METADATA_OFFSET };
