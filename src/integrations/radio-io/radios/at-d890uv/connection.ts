/**
 * AT-D890UV serial session — PROGRAM→QX, ident, 16-byte R/W.
 */

import type { BytePipe } from '../../types.ts';
import {
  ANYTONE_DMR_BLOCK_SIZE,
  enterAnytoneDmrProgramMode,
  exitAnytoneDmrProgramMode,
  makeAnytoneDmrReadFrame,
  makeAnytoneDmrWriteFrame,
  parseAnytoneDmrReadReply,
  probeAnytoneDmrIdent,
} from '../../kit/codecs/anytoneDmrRw.ts';
import { RadioProtocolError, RadioTimeoutError, RadioWrongIdentError } from '../../kit/errors.ts';
import { throwIfAborted } from '../../kit/progress.ts';
import { AT_D890_CONNECTION, AT_D890UV_MODEL_IDS } from './constants.ts';
import { assertAtD890WritableAddress } from './writableExtents.ts';

const TD = new TextDecoder('ascii', { fatal: false });

const AT_D890_IDENT_MODEL = 'ID890UV';
const AT_D890_IDENT_VERSION = 'V100';
const AT_D890_IDENT_MODEL_LEN = 7;
const AT_D890_IDENT_BAND_OFFSET = 8;
const AT_D890_IDENT_VERSION_OFFSET = 9;
const AT_D890_IDENT_VERSION_LEN = 4;

export interface AtD890Ident {
  raw: Uint8Array;
  model: string;
  version: string;
  /** Byte 8. Stored only — a band code is not used to accept or refuse the radio. */
  bandCode: number;
}

function asciiAt(raw: Uint8Array, offset: number, length: number): string {
  return TD.decode(raw.subarray(offset, offset + length));
}

export function parseAtD890Ident(raw: Uint8Array): AtD890Ident {
  const model = asciiAt(raw, 0, AT_D890_IDENT_MODEL_LEN);
  const version = asciiAt(raw, AT_D890_IDENT_VERSION_OFFSET, AT_D890_IDENT_VERSION_LEN);
  const bandCode = raw[AT_D890_IDENT_BAND_OFFSET] ?? 0;
  if (model !== AT_D890_IDENT_MODEL) {
    throw new RadioWrongIdentError(
      `Unsupported Anytone ident "${model}" — expected ID890UV / V100 for AT-D890UV`,
    );
  }
  if (version !== AT_D890_IDENT_VERSION) {
    throw new RadioWrongIdentError(
      `Unsupported Anytone ident version "${version}" — expected ID890UV / V100 for AT-D890UV`,
    );
  }
  return { raw, model, version, bandCode };
}

export async function atD890EnterProgram(pipe: BytePipe, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  await enterAnytoneDmrProgramMode(pipe, AT_D890_CONNECTION.TIMEOUT.HANDSHAKE_MS, {
    programAck: 'qx-only',
  });
}

export async function atD890ProbeIdent(pipe: BytePipe, signal?: AbortSignal): Promise<AtD890Ident> {
  throwIfAborted(signal);
  const raw = await probeAnytoneDmrIdent(pipe, AT_D890_CONNECTION.TIMEOUT.IDENT_MS);
  return parseAtD890Ident(raw);
}

export async function atD890ExitProgram(pipe: BytePipe): Promise<void> {
  await exitAnytoneDmrProgramMode(pipe);
}

/** Original send plus two resends of the same frame. */
const AT_D890_RESEND_LIMIT = 2;

function isChecksumMismatch(err: unknown): boolean {
  return err instanceof RadioProtocolError && err.message.includes('checksum mismatch');
}

/**
 * Run `exchange` up to three times. Timeout flushes leftover bytes before the next send.
 * A checksum failure does not flush — that frame was already consumed.
 */
async function exchangeWithResend<T>(
  pipe: BytePipe,
  signal: AbortSignal | undefined,
  exchange: () => Promise<T>,
  shouldResend: (err: unknown) => boolean,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= AT_D890_RESEND_LIMIT; attempt++) {
    throwIfAborted(signal);
    try {
      return await exchange();
    } catch (err) {
      lastErr = err;
      if (!shouldResend(err) || attempt === AT_D890_RESEND_LIMIT) {
        throw err;
      }
      if (err instanceof RadioTimeoutError) {
        await pipe.flush?.();
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new RadioProtocolError('D890 frame exchange failed');
}

async function readChunkWithFallback(
  pipe: BytePipe,
  address: number,
  chunkLen: number,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  try {
    // `atD890ReadBlockRaw` already spent its resend budget. This catch is the size fallback only.
    return await atD890ReadBlockRaw(pipe, address, chunkLen, signal);
  } catch (firstErr) {
    if (chunkLen <= ANYTONE_DMR_BLOCK_SIZE) {
      throw firstErr;
    }
    const fallback = new Uint8Array(chunkLen);
    for (let sub = 0; sub < chunkLen; sub += ANYTONE_DMR_BLOCK_SIZE) {
      const subChunk = await atD890ReadBlockRaw(
        pipe,
        address + sub,
        ANYTONE_DMR_BLOCK_SIZE,
        signal,
      );
      fallback.set(subChunk, sub);
    }
    return fallback;
  }
}

export async function atD890ReadMemory(
  pipe: BytePipe,
  address: number,
  length: number,
  signal?: AbortSignal,
  readBlockSize = ANYTONE_DMR_BLOCK_SIZE,
): Promise<Uint8Array> {
  throwIfAborted(signal);
  if (length % ANYTONE_DMR_BLOCK_SIZE !== 0) {
    throw new RangeError(`D890 read length must be 16-byte aligned: ${length}`);
  }
  if (
    readBlockSize % ANYTONE_DMR_BLOCK_SIZE !== 0 ||
    readBlockSize < ANYTONE_DMR_BLOCK_SIZE ||
    readBlockSize > 0xff
  ) {
    throw new RangeError(`D890 read block size must be 16-aligned and 16..255: ${readBlockSize}`);
  }
  const out = new Uint8Array(length);
  let off = 0;
  while (off < length) {
    const chunkLen = Math.min(readBlockSize, length - off);
    const payload = await readChunkWithFallback(pipe, address + off, chunkLen, signal);
    out.set(payload, off);
    off += chunkLen;
  }
  return out;
}

/**
 * Single read frame at an arbitrary block length, bypassing the 16-byte loop.
 *
 * The wire length field is a `u8`, so the protocol can express far more than the 16 bytes
 * `atD890ReadMemory` uses. Whether a given radio honours a larger block is a question only
 * hardware answers — hence this raw form, used by the link prober. Read-only.
 */
export async function atD890ReadBlockRaw(
  pipe: BytePipe,
  address: number,
  length: number,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  throwIfAborted(signal);
  if (length < 1 || length > 0xff) {
    throw new RangeError(`D890 raw read length must be 1..255, got ${length}`);
  }
  return exchangeWithResend(
    pipe,
    signal,
    async () => {
      await pipe.write(makeAnytoneDmrReadFrame(address, length));
      const reply = await pipe.readExact(length + 8, AT_D890_CONNECTION.TIMEOUT.READ_MS);
      return parseAnytoneDmrReadReply(reply, length, address);
    },
    (err) => err instanceof RadioTimeoutError || isChecksumMismatch(err),
  );
}

export async function atD890WriteMemory(
  pipe: BytePipe,
  address: number,
  data: Uint8Array,
  signal?: AbortSignal,
  opts?: { transmitGuard?: (address: number) => void },
): Promise<void> {
  const guard = opts?.transmitGuard ?? assertAtD890WritableAddress;
  throwIfAborted(signal);
  guard(address);
  if (data.length % ANYTONE_DMR_BLOCK_SIZE !== 0) {
    throw new RangeError(`D890 write data must be 16-byte aligned: ${data.length}`);
  }
  for (let off = 0; off < data.length; off += ANYTONE_DMR_BLOCK_SIZE) {
    const addr = address + off;
    guard(addr);
    const chunk = data.subarray(off, off + ANYTONE_DMR_BLOCK_SIZE);
    const frame = makeAnytoneDmrWriteFrame(addr, ANYTONE_DMR_BLOCK_SIZE, chunk);
    await exchangeWithResend(
      pipe,
      signal,
      async () => {
        await pipe.write(frame);
        const ack = await pipe.readExact(1, AT_D890_CONNECTION.TIMEOUT.WRITE_MS);
        if (ack[0] !== 0x06) {
          throw new RadioProtocolError(
            `D890 write not ACKed at 0x${addr.toString(16)}: got 0x${ack[0]?.toString(16) ?? '??'}`,
          );
        }
      },
      (err) => err instanceof RadioTimeoutError,
    );
    if (AT_D890_CONNECTION.INTER_BLOCK_DELAY_MS > 0) {
      await new Promise((r) => setTimeout(r, AT_D890_CONNECTION.INTER_BLOCK_DELAY_MS));
    }
  }
}

/**
 * Single write frame at an arbitrary 16-aligned block length, bypassing the 16-byte loop.
 *
 * Counterpart to {@link atD890ReadBlockRaw}: the wire length field is a `u8`, and reads are
 * measured to honour 240 bytes, but whether writes do is untested. Used by the write-block
 * probe. Still address-fenced — this widens the block size, never the allow-list.
 */
export async function atD890WriteBlockRaw(
  pipe: BytePipe,
  address: number,
  data: Uint8Array,
  signal?: AbortSignal,
): Promise<void> {
  throwIfAborted(signal);
  if (data.length < 1 || data.length > 0xff) {
    throw new RangeError(`D890 raw write length must be 1..255, got ${data.length}`);
  }
  // Every 16-byte boundary the frame spans must be allow-listed, so a long frame cannot
  // straddle out of a permitted bank.
  for (let off = 0; off < data.length; off += ANYTONE_DMR_BLOCK_SIZE) {
    assertAtD890WritableAddress(address + off);
  }
  const frame = makeAnytoneDmrWriteFrame(address, data.length, data);
  await exchangeWithResend(
    pipe,
    signal,
    async () => {
      await pipe.write(frame);
      const ack = await pipe.readExact(1, AT_D890_CONNECTION.TIMEOUT.WRITE_MS);
      if (ack[0] !== 0x06) {
        throw new RadioProtocolError(
          `D890 write not ACKed at 0x${address.toString(16)} (${data.length} bytes): got 0x${ack[0]?.toString(16) ?? '??'}`,
        );
      }
    },
    (err) => err instanceof RadioTimeoutError,
  );
}

export function atD890ModelHints(): readonly string[] {
  return AT_D890UV_MODEL_IDS;
}
