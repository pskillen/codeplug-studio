/**
 * Read-only RadioFoundry debug capture frame guard.
 *
 * Every frame to the radio during a debug read passes through here. Only INFO, VERSION, SUMS, READ
 * and IDDB with database id 0 are admitted. A refusal latches; after abort every write throws
 * RadioAbortedError. Wire detail: docs/reference/radios/radiofoundry/debug-capture.md.
 */
import type { BytePipe } from '../../types.ts';
import {
  decodeDebugFrame,
  encodeDebugFrame,
  type DebugFrame,
} from '../../kit/codecs/radioFoundryDebugLink.ts';
import { RadioAbortedError, RadioProtocolError } from '../../kit/errors.ts';
import {
  BLOCK_SIZE,
  CODEPLUG_COMMAND,
  EEPROM_IMAGE_END,
  FLASH_IMAGE_START,
  OP_INFO,
  OP_READ,
  OP_SUMS,
} from './constants.ts';
import { DMR_ID_DATABASE_AREA2_ADDRESS } from './idDatabase.ts';
import { RADIOFOUNDRY_VERSION_COMMAND } from './version.ts';
import type { RadioFoundryCableBoard } from './board.ts';

const IDDB_COMMAND = 0x1f;

export class RadioFoundryDebugRefusedError extends RadioProtocolError {
  constructor(reason: string) {
    super(`RadioFoundry debug capture refused a frame: ${reason}`);
    this.name = 'RadioFoundryDebugRefusedError';
  }
}

export type RadioFoundryDebugFrameKind = 'info' | 'version' | 'sums' | 'read' | 'iddb';

export type RadioFoundryDebugFrameClass =
  { allowed: true; kind: RadioFoundryDebugFrameKind } | { allowed: false; reason: string };

function blockInsideImage(addr: number, ceiling: number): boolean {
  if (!Number.isInteger(addr) || addr < 0 || addr % BLOCK_SIZE !== 0) return false;
  const inEeprom = addr + BLOCK_SIZE <= EEPROM_IMAGE_END;
  const inFlash = addr >= FLASH_IMAGE_START && addr + BLOCK_SIZE <= ceiling;
  const inArea2 = addr >= DMR_ID_DATABASE_AREA2_ADDRESS && addr + BLOCK_SIZE <= ceiling;
  return inEeprom || inFlash || inArea2;
}

function classifyCodeplug(payload: Uint8Array, ceiling: number): RadioFoundryDebugFrameClass {
  if (payload.length === 0) return { allowed: false, reason: 'empty CODEPLUG payload' };
  const op = payload[0]!;
  const args = payload.subarray(1);
  if (op === OP_INFO) {
    if (payload.length !== 1) {
      return { allowed: false, reason: `INFO payload is ${payload.length} bytes` };
    }
    return { allowed: true, kind: 'info' };
  }
  if (op === OP_SUMS) {
    if (args.length !== 5) return { allowed: false, reason: `SUMS args are ${args.length} bytes` };
    const addr = (args[0]! | (args[1]! << 8) | (args[2]! << 16) | (args[3]! << 24)) >>> 0;
    const count = args[4]!;
    if (count < 1 || count > 16) {
      return { allowed: false, reason: `SUMS count ${count}` };
    }
    for (let j = 0; j < count; j += 1) {
      if (!blockInsideImage(addr + j * BLOCK_SIZE, ceiling)) {
        return { allowed: false, reason: `SUMS block ${j} past image` };
      }
    }
    return { allowed: true, kind: 'sums' };
  }
  if (op === OP_READ) {
    if (args.length !== 6) return { allowed: false, reason: `READ args are ${args.length} bytes` };
    const addr = (args[0]! | (args[1]! << 8) | (args[2]! << 16) | (args[3]! << 24)) >>> 0;
    if (!blockInsideImage(addr, ceiling)) {
      return { allowed: false, reason: `READ at 0x${addr.toString(16)}` };
    }
    return { allowed: true, kind: 'read' };
  }
  return { allowed: false, reason: `CODEPLUG op ${op}` };
}

/** Stateless shape check for one whole debug-link request frame. */
export function classifyRadioFoundryDebugFrame(
  data: Uint8Array,
  imageEnd: number,
): RadioFoundryDebugFrameClass {
  if (data.length < 2) {
    if (
      data.length === 1 &&
      (data[0] === 0x52 || data[0] === 0x57 || data[0] === 0x58 || data[0] === 0x43)
    ) {
      return { allowed: false, reason: `legacy byte 0x${data[0]!.toString(16)}` };
    }
    if (data.length === 1 && data[0] === 0xe0) {
      return { allowed: false, reason: 'MMDVM 0xE0' };
    }
    return { allowed: false, reason: 'not a debug-link frame' };
  }
  if (data[0] !== 0xa5 || data[1] !== 0x5a) {
    const lead = data[0]!;
    if (lead === 0x52) return { allowed: false, reason: 'OpenGD77 R' };
    if (lead === 0x57) return { allowed: false, reason: 'OpenGD77 W' };
    if (lead === 0x58) return { allowed: false, reason: 'OpenGD77 X' };
    if (lead === 0x43) return { allowed: false, reason: 'OpenGD77 C' };
    if (lead === 0xe0) return { allowed: false, reason: 'MMDVM 0xE0' };
    return { allowed: false, reason: 'not a debug-link frame' };
  }
  let frame: DebugFrame;
  try {
    frame = decodeDebugFrame(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'bad frame';
    if (msg.includes('CRC')) return { allowed: false, reason: 'bad CRC' };
    if (msg.includes('length')) return { allowed: false, reason: 'truncated frame' };
    return { allowed: false, reason: 'not a debug-link frame' };
  }
  if (frame.command === RADIOFOUNDRY_VERSION_COMMAND) {
    if (frame.payload.length !== 0) {
      return { allowed: false, reason: `VERSION payload is ${frame.payload.length} bytes` };
    }
    return { allowed: true, kind: 'version' };
  }
  if (frame.command === IDDB_COMMAND) {
    if (frame.payload.length !== 4) {
      return { allowed: false, reason: `IDDB payload is ${frame.payload.length} bytes` };
    }
    if (frame.payload.some((b) => b !== 0)) {
      return { allowed: false, reason: 'IDDB id is not 0' };
    }
    return { allowed: true, kind: 'iddb' };
  }
  if (frame.command === CODEPLUG_COMMAND) {
    return classifyCodeplug(frame.payload, imageEnd);
  }
  const forbidden: Record<number, string> = {
    0x01: 'PING',
    0x06: 'KEY',
    0x07: 'PTT',
    0x0a: 'RADIO',
    0x0c: 'READ_MEM',
    0x0d: 'REBOOT',
    0x0f: 'STORAGE',
    0x23: 'CPKV',
    0x26: 'SATELLITE',
  };
  const name = forbidden[frame.command] ?? `command 0x${frame.command.toString(16)}`;
  return { allowed: false, reason: name };
}

export interface RadioFoundryDebugGuard {
  pipe: BytePipe;
  failure(): unknown;
  received(): Uint8Array;
  limitImageEnd(end: number): void;
}

export function createRadioFoundryDebugGuard(
  pipe: BytePipe,
  board: RadioFoundryCableBoard,
  signal?: AbortSignal,
): RadioFoundryDebugGuard {
  let failed: unknown;
  let infoSent = false;
  let ceiling = board.limits.IMAGE_END;
  const rxTap: number[] = [];

  const refuse = (reason: string): never => {
    const error = new RadioFoundryDebugRefusedError(reason);
    failed ??= error;
    throw error;
  };

  const admit = (data: Uint8Array): void => {
    if (failed !== undefined) {
      throw new RadioFoundryDebugRefusedError(
        `session is no longer usable (${failed instanceof Error ? failed.message : 'failed'})`,
      );
    }
    if (signal?.aborted) throw new RadioAbortedError();
    let frame: DebugFrame;
    try {
      frame = decodeDebugFrame(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'bad frame';
      if (msg.includes('CRC')) return refuse('bad CRC');
      if (msg.includes('length')) return refuse('truncated frame');
      return refuse('not exactly one debug-link frame');
    }
    const cls = classifyRadioFoundryDebugFrame(data, ceiling);
    if (!cls.allowed) return refuse(cls.reason);
    if (cls.kind !== 'info' && !infoSent) return refuse('frame before INFO');
    if (cls.kind === 'info') infoSent = true;
  };

  const appendRx = (chunk: Uint8Array): void => {
    for (let i = 0; i < chunk.length && rxTap.length < 64; i += 1) rxTap.push(chunk[i]!);
  };

  const safe: BytePipe = {
    get baudRate() {
      return pipe.baudRate;
    },
    async write(data) {
      admit(data);
      await pipe.write(data.slice());
    },
    async readExact(n, timeoutMs) {
      const out = await pipe.readExact(n, timeoutMs);
      appendRx(out);
      return out;
    },
    flush: pipe.flush ? () => pipe.flush!() : undefined,
    drain: pipe.drain ? () => pipe.drain!() : undefined,
    close: () => pipe.close(),
  };

  return {
    pipe: safe,
    failure: () => failed,
    received: () => new Uint8Array(rxTap),
    limitImageEnd(end: number) {
      if (end < ceiling) ceiling = end;
    },
  };
}

/** Build a refused CODEPLUG frame for tests (command only; payload after op byte). */
export function encodeRefusedCodeplugFrame(op: number, args: number[] = []): Uint8Array {
  return encodeDebugFrame(CODEPLUG_COMMAND, 1, Uint8Array.from([op, ...args]));
}

/** Build a refused debug-link command for tests. */
export function encodeRefusedDebugCommand(command: number, payload: number[] = []): Uint8Array {
  return encodeDebugFrame(command, 1, Uint8Array.from(payload));
}
