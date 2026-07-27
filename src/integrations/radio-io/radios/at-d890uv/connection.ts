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
import { RadioProtocolError, RadioWrongIdentError } from '../../kit/errors.ts';
import { throwIfAborted } from '../../kit/progress.ts';
import {
  AT_D890_CONNECTION,
  AT_D890UV_MODEL_IDS,
} from './constants.ts';
import { assertAtD890WritableAddress } from './writableExtents.ts';

const TD = new TextDecoder('ascii', { fatal: false });

export interface AtD890Ident {
  raw: Uint8Array;
  model: string;
  version: string;
}

export function parseAtD890Ident(raw: Uint8Array): AtD890Ident {
  const text = TD.decode(raw).replace(/\0/g, '\0');
  const parts = text.split('\0').filter((p) => p.length > 0);
  const model = parts[0] ?? '';
  const version = parts[1] ?? '';
  if (model !== 'ID890UV') {
    throw new RadioWrongIdentError(
      `Unsupported Anytone ident "${model}" — expected ID890UV / V100 for AT-D890UV`,
    );
  }
  return { raw, model, version };
}

export async function atD890EnterProgram(pipe: BytePipe, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  await enterAnytoneDmrProgramMode(pipe, AT_D890_CONNECTION.TIMEOUT.HANDSHAKE_MS);
}

export async function atD890ProbeIdent(pipe: BytePipe, signal?: AbortSignal): Promise<AtD890Ident> {
  throwIfAborted(signal);
  const raw = await probeAnytoneDmrIdent(pipe, AT_D890_CONNECTION.TIMEOUT.IDENT_MS);
  return parseAtD890Ident(raw);
}

export async function atD890ExitProgram(pipe: BytePipe): Promise<void> {
  await exitAnytoneDmrProgramMode(pipe);
}

export async function atD890ReadMemory(
  pipe: BytePipe,
  address: number,
  length: number,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  throwIfAborted(signal);
  if (length % ANYTONE_DMR_BLOCK_SIZE !== 0) {
    throw new RangeError(`D890 read length must be 16-byte aligned: ${length}`);
  }
  const out = new Uint8Array(length);
  for (let off = 0; off < length; off += ANYTONE_DMR_BLOCK_SIZE) {
    const chunkLen = ANYTONE_DMR_BLOCK_SIZE;
    const addr = address + off;
    await pipe.write(makeAnytoneDmrReadFrame(addr, chunkLen));
    const reply = await pipe.readExact(
      ANYTONE_DMR_BLOCK_SIZE + 8,
      AT_D890_CONNECTION.TIMEOUT.READ_MS,
    );
    const payload = parseAnytoneDmrReadReply(reply, chunkLen);
    out.set(payload, off);
  }
  return out;
}

export async function atD890WriteMemory(
  pipe: BytePipe,
  address: number,
  data: Uint8Array,
  signal?: AbortSignal,
): Promise<void> {
  throwIfAborted(signal);
  assertAtD890WritableAddress(address);
  if (data.length % ANYTONE_DMR_BLOCK_SIZE !== 0) {
    throw new RangeError(`D890 write data must be 16-byte aligned: ${data.length}`);
  }
  for (let off = 0; off < data.length; off += ANYTONE_DMR_BLOCK_SIZE) {
    const addr = address + off;
    assertAtD890WritableAddress(addr);
    const chunk = data.subarray(off, off + ANYTONE_DMR_BLOCK_SIZE);
    await pipe.write(makeAnytoneDmrWriteFrame(addr, ANYTONE_DMR_BLOCK_SIZE, chunk));
    const ack = await pipe.readExact(1, AT_D890_CONNECTION.TIMEOUT.WRITE_MS);
    if (ack[0] !== 0x06) {
      throw new RadioProtocolError(
        `D890 write not ACKed at 0x${addr.toString(16)}: got 0x${ack[0]?.toString(16) ?? '??'}`,
      );
    }
  }
}

export function atD890ModelHints(): readonly string[] {
  return AT_D890UV_MODEL_IDS;
}
