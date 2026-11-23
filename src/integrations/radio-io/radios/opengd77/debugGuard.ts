/**
 * Read-only OpenGD77 / OpenUV380 debug session guard.
 *
 * The guard is the only path to the transport for a debug capture. Each frame must be byte-exact
 * one of: ping (`43 FE`), show CPS (`43 00`), close CPS (`43 05`), the FirmwareInfo read
 * (`52 09 00 00 00 00 00 2E`) or a FLASH read (`52 01 <addr u32 BE> <len u16 BE>`, 1 to 32 bytes,
 * inside the 16 MiB part). Order: show CPS only after the FirmwareInfo read, FLASH reads only after
 * show CPS, close CPS once and only after show CPS (everything after it is refused). A refusal
 * latches: no later frame at all. After abort every frame is refused with `RadioAbortedError`
 * except one close CPS (when show CPS has passed); an abort refusal does not latch, so that close
 * can still go. Reply reads (`readExact`, `flush`, `drain`) never send anything.
 * Wire facts: docs/reference/radios/opengd77/protocol.md (Debug capture allow-list).
 */
import type { BytePipe } from '../../types.ts';
import {
  makeCommandFrame,
  makeOpenGd77ReadFrame,
  makePingFrame,
  OPENGD77_BLOCK,
} from '../../kit/codecs/opengd77Serial.ts';
import { RadioAbortedError, RadioProtocolError } from '../../kit/errors.ts';
import {
  OPENGD77_CMD_CLOSE_CPS,
  OPENGD77_CMD_SHOW_CPS,
  OPENGD77_MEM_FIRMWARE_INFO,
  OPENGD77_MEM_FLASH,
} from './constants.ts';
import { OPENGD77_FIRMWARE_INFO_SIZE } from './protocol.ts';
import { OPENGD77_RADIOFOUNDRY_PROBE_FRAME } from './radioFoundryProbe.ts';

/** Highest address + length a FLASH read may reach (16 MiB part). */
export const OPENGD77_DEBUG_FLASH_LIMIT = 0x0100_0000;

export class OpenGd77DebugRefusedError extends RadioProtocolError {
  constructor(reason: string) {
    super(`OpenGD77 debug capture refused a frame: ${reason}`);
    this.name = 'OpenGd77DebugRefusedError';
  }
}

export type OpenGd77DebugFrameKind =
  | 'ping'
  | 'show-cps'
  | 'close-cps'
  | 'firmware-info'
  | 'flash-read'
  | 'radiofoundry-probe';

export type OpenGd77DebugFrameClass =
  { allowed: true; kind: OpenGd77DebugFrameKind } | { allowed: false; reason: string };

const same = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && b.every((value, i) => a[i] === value);

const PING = makePingFrame();
const SHOW_CPS = makeCommandFrame(OPENGD77_CMD_SHOW_CPS);
const CLOSE_CPS = makeCommandFrame(OPENGD77_CMD_CLOSE_CPS);
const FIRMWARE_INFO = makeOpenGd77ReadFrame(
  OPENGD77_MEM_FIRMWARE_INFO,
  0,
  OPENGD77_FIRMWARE_INFO_SIZE,
);

const hex = (n: number | undefined) => (n === undefined ? '??' : n.toString(16).padStart(2, '0'));

/** Stateless shape check: is this exactly one allow-listed frame? */
export function classifyOpenGd77DebugFrame(frame: Uint8Array): OpenGd77DebugFrameClass {
  if (frame.length === 0) return { allowed: false, reason: 'empty frame' };
  if (same(frame, PING)) return { allowed: true, kind: 'ping' };
  if (same(frame, SHOW_CPS)) return { allowed: true, kind: 'show-cps' };
  if (same(frame, CLOSE_CPS)) return { allowed: true, kind: 'close-cps' };
  if (same(frame, FIRMWARE_INFO)) return { allowed: true, kind: 'firmware-info' };
  if (same(frame, OPENGD77_RADIOFOUNDRY_PROBE_FRAME))
    return { allowed: true, kind: 'radiofoundry-probe' };
  if (frame[0] === 0x52) {
    if (frame.length !== 8) {
      return { allowed: false, reason: `read frame of ${frame.length} bytes` };
    }
    if (frame[1] !== OPENGD77_MEM_FLASH) {
      return { allowed: false, reason: `read mode 0x${hex(frame[1])}` };
    }
    const addr = ((frame[2]! << 24) | (frame[3]! << 16) | (frame[4]! << 8) | frame[5]!) >>> 0;
    const length = (frame[6]! << 8) | frame[7]!;
    if (length < 1 || length > OPENGD77_BLOCK) {
      return { allowed: false, reason: `read length ${length}` };
    }
    if (addr + length > OPENGD77_DEBUG_FLASH_LIMIT) {
      return { allowed: false, reason: `read past 0x${OPENGD77_DEBUG_FLASH_LIMIT.toString(16)}` };
    }
    return { allowed: true, kind: 'flash-read' };
  }
  if (frame[0] === 0x43) {
    return { allowed: false, reason: `command 0x${hex(frame[1])} (${frame.length} bytes)` };
  }
  return { allowed: false, reason: `frame type 0x${hex(frame[0])} (${frame.length} bytes)` };
}

export interface OpenGd77DebugGuard {
  pipe: BytePipe;
  /** The first refusal that latched the guard. */
  failure(): unknown;
}

/** Wrap the transport so only the read-only session above can reach it. */
export function createOpenGd77DebugGuard(pipe: BytePipe, signal?: AbortSignal): OpenGd77DebugGuard {
  let failed: unknown;
  let firmwareInfoSent = false;
  let cpsShown = false;
  let closed = false;
  let probed = false;

  const refuse = (reason: string): never => {
    const error = new OpenGd77DebugRefusedError(reason);
    failed ??= error;
    throw error;
  };

  const admit = (data: Uint8Array): void => {
    const cls = classifyOpenGd77DebugFrame(data);
    if (failed !== undefined) {
      throw new OpenGd77DebugRefusedError(
        `session is no longer usable (${failed instanceof Error ? failed.message : 'failed'})`,
      );
    }
    if (signal?.aborted) {
      // The one frame allowed after abort: put the radio's UI back. An abort refusal never latches.
      if (cls.allowed && cls.kind === 'close-cps' && cpsShown && !closed) {
        closed = true;
        return;
      }
      throw new RadioAbortedError();
    }
    if (!cls.allowed) return refuse(cls.reason);
    if (closed) return refuse('frame after close CPS');
    switch (cls.kind) {
      case 'ping':
        break;
      case 'firmware-info':
        firmwareInfoSent = true;
        break;
      case 'show-cps':
        if (!firmwareInfoSent) return refuse('show CPS before the FirmwareInfo read');
        cpsShown = true;
        break;
      case 'flash-read':
        if (!cpsShown) return refuse('FLASH read before show CPS');
        break;
      case 'close-cps':
        if (!cpsShown) return refuse('close CPS before show CPS');
        closed = true;
        break;
      case 'radiofoundry-probe':
        if (!firmwareInfoSent) return refuse('RadioFoundry probe before the FirmwareInfo read');
        if (cpsShown) return refuse('RadioFoundry probe after show CPS');
        if (probed) return refuse('RadioFoundry probe sent twice');
        probed = true;
        break;
    }
  };

  const safe: BytePipe = {
    get baudRate() {
      return pipe.baudRate;
    },
    async write(data) {
      admit(data);
      await pipe.write(data.slice());
    },
    readExact: (n, timeoutMs) => pipe.readExact(n, timeoutMs),
    flush: pipe.flush ? () => pipe.flush!() : undefined,
    drain: pipe.drain ? () => pipe.drain!() : undefined,
    close: () => pipe.close(),
  };
  return { pipe: safe, failure: () => failed };
}
