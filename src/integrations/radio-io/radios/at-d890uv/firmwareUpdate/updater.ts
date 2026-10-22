/**
 * AT-D890UV firmware updater: a port of `Sender` in the firmware project's `tools/d890update.py`, firmware mode only.
 * Every byte goes through `createGuardedSend` (the only write site) with `checkD890Outgoing` as the guard.
 * One automatic resend per frame, as the vendor CPS does; a second failure aborts and nothing more is sent.
 */
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';

import { FirmwareFlashError } from '../../../firmware/errors.ts';
import { createGuardedSend } from '../../../firmware/guardedSend.ts';
import type {
  FirmwareBootloaderIdent,
  FirmwareFlashEnd,
  FirmwareFlashPhase,
  FirmwareFlashProgress,
  FirmwareFlashResult,
  FirmwareFlashTiming,
  FirmwareUpdater,
} from '../../../firmware/types.ts';
import {
  RadioClosedError,
  RadioInterlockError,
  RadioProtocolError,
  RadioTimeoutError,
} from '../../../kit/errors.ts';
import { throwIfAborted } from '../../../kit/progress.ts';
import type { BytePipe } from '../../../types.ts';
import {
  AT_D890_FW_ACK,
  AT_D890_FW_BOOTLOADER_BAND,
  AT_D890_FW_END,
  AT_D890_FW_IDENT_LEN,
  AT_D890_FW_IDENT_REQ,
  AT_D890_FW_LINK,
  AT_D890_FW_TIMEOUT_MS,
  AT_D890_FW_UPDATE,
  AT_D890_FW_UPDATE_REPLY_MAX,
} from './constants.ts';
import { makeD890UpdateFrame } from './frames.ts';
import { AT_D890_FW_RADIO_ID, checkD890FirmwareImage, checkD890Outgoing } from './interlocks.ts';
import { d890BlockCount, d890Blocks } from './package.ts';

/** Progress is emitted on each phase change and every this many data frames. */
const PROGRESS_EVERY_FRAMES = 256;

const IDENT_REQ = Uint8Array.of(AT_D890_FW_IDENT_REQ);
const END = Uint8Array.of(AT_D890_FW_END);

const hexBytes = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(' ');
const hex32 = (a: number) => `0x${a.toString(16).toUpperCase().padStart(8, '0')}`;

function ascii(b: Uint8Array): string {
  const nul = b.indexOf(0);
  return String.fromCharCode(...(nul < 0 ? b : b.subarray(0, nul))).trim();
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Median, p99 and max of the first `count` samples. */
export function summariseD890FrameTiming(
  samples: Float64Array,
  count: number,
): FirmwareFlashTiming | undefined {
  if (count <= 0) return undefined;
  const sorted = samples.slice(0, count).sort();
  const at = (q: number) => sorted[Math.min(count - 1, Math.ceil(q * count) - 1)]!;
  const round = (ms: number) => Math.round(ms * 100) / 100;
  return {
    medianFrameMs: round(at(0.5)),
    p99FrameMs: round(at(0.99)),
    maxFrameMs: round(sorted[count - 1]!),
  };
}

interface BoundSession {
  readonly pipe: BytePipe;
  readonly send: (frame: Uint8Array) => Promise<void>;
  readonly ident: FirmwareBootloaderIdent;
}

async function readByte(pipe: BytePipe, timeoutMs: number): Promise<number | null> {
  try {
    return (await pipe.readExact(1, timeoutMs))[0]!;
  } catch (err) {
    if (err instanceof RadioTimeoutError) return null;
    throw err;
  }
}

export function createD890FirmwareUpdater(): FirmwareUpdater {
  let session: BoundSession | null = null;

  return {
    radioId: AT_D890_FW_RADIO_ID,
    link: AT_D890_FW_LINK,

    checkImage(image: PreparedFirmwareImage): void {
      checkD890FirmwareImage(image);
    },

    async identify(pipe, identifyOpts) {
      session = null;
      const send = createGuardedSend(pipe, checkD890Outgoing);
      throwIfAborted(identifyOpts?.signal);
      await pipe.flush?.();
      await send(AT_D890_FW_UPDATE);

      // The reply length is not fixed: read one byte at a time until 06, within the handshake timeout overall.
      const reply: number[] = [];
      const deadline = now() + AT_D890_FW_TIMEOUT_MS.HANDSHAKE;
      while (reply.length < AT_D890_FW_UPDATE_REPLY_MAX) {
        const left = Math.max(0, deadline - now());
        const b = left > 0 ? await readByte(pipe, left) : null;
        if (b === null) break;
        reply.push(b);
        if (b === AT_D890_FW_ACK) break;
      }
      if (reply.length === 0 || reply[reply.length - 1] !== AT_D890_FW_ACK) {
        throw new RadioProtocolError(
          `The radio did not answer the update request (${hexBytes(Uint8Array.from(reply)) || 'nothing'}). Is it in update mode?`,
        );
      }

      throwIfAborted(identifyOpts?.signal);
      await send(IDENT_REQ);
      const raw = await pipe.readExact(AT_D890_FW_IDENT_LEN, AT_D890_FW_TIMEOUT_MS.HANDSHAKE);
      if (raw[0] !== 0x49 || raw[AT_D890_FW_IDENT_LEN - 1] !== AT_D890_FW_ACK) {
        throw new RadioProtocolError(`Unexpected bootloader ident: ${hexBytes(raw)}.`);
      }
      const ident: FirmwareBootloaderIdent = {
        radioId: AT_D890_FW_RADIO_ID,
        model: ascii(raw.subarray(1, 8)),
        version: ascii(raw.subarray(9, 13)),
        raw,
      };
      session = { pipe, send, ident };
      return ident;
    },

    async flash(image, flashOpts) {
      const started = Date.now();
      let radioTouched = false;
      let position = 'checks';
      let framesSent = 0;
      let samples: Float64Array | null = null;
      let timed = 0;
      const bound = session;
      // One flash per identify: a retry must re-enter update mode and identify again.
      session = null;
      try {
        if (!bound) {
          throw new RadioProtocolError('The bootloader has not been identified in this session.');
        }
        const pkg = checkD890FirmwareImage(image);
        const { ident, pipe, send } = bound;
        if (ident.model !== pkg.model || ident.version !== pkg.version) {
          throw new RadioInterlockError(
            `Model Error. Radio: ${ident.model} ${ident.version ?? ''}; package: ${pkg.model} ${pkg.version}.`,
          );
        }
        if (ident.raw[8] !== AT_D890_FW_BOOTLOADER_BAND) {
          throw new RadioInterlockError(
            'The radio is not in its bootloader (update mode). Switch it off and enter update mode again.',
          );
        }

        const total = d890BlockCount(pkg);
        samples = new Float64Array(total);
        const emit = (cur: number, max: number, phase: FirmwareFlashPhase, msg: string) => {
          const update: FirmwareFlashProgress = {
            cur,
            max,
            msg,
            stage: phase,
            phase,
            radioTouched,
          };
          flashOpts.onProgress?.(update);
        };

        let n = 0;
        for (const { addr, data } of d890Blocks(pkg)) {
          position = `frame ${n + 1}/${total} @ ${hex32(addr)}`;
          // Abort checks sit between frames only, never mid-frame.
          throwIfAborted(flashOpts.signal);
          const frame = makeD890UpdateFrame(addr, data);
          if (!radioTouched) {
            radioTouched = true;
            emit(0, total, 'transfer', `Transfer 0/${total}`);
          }
          const timeoutMs =
            n === 0 ? AT_D890_FW_TIMEOUT_MS.FIRST_FRAME : AT_D890_FW_TIMEOUT_MS.FRAME;
          const t0 = now();
          let last: number | null = null;
          for (let attempt = 0; attempt < 2; attempt++) {
            await send(frame);
            framesSent += 1;
            last = await readByte(pipe, timeoutMs);
            if (last === AT_D890_FW_ACK) break;
            await pipe.flush?.();
          }
          if (last !== AT_D890_FW_ACK) {
            throw new RadioProtocolError(
              `The radio did not accept ${position} after 2 attempts (last reply ${last === null ? 'nothing' : last.toString(16).padStart(2, '0')}).`,
            );
          }
          samples[timed++] = now() - t0;
          n += 1;
          if (n % PROGRESS_EVERY_FRAMES === 0 || n === total) {
            emit(n, total, 'transfer', `Transfer ${n}/${total}`);
          }
        }

        position = 'end';
        throwIfAborted(flashOpts.signal);
        emit(total, total, 'finish', 'Finishing');
        await send(END);
        framesSent += 1;
        let end: FirmwareFlashEnd;
        try {
          const r = (await pipe.readExact(1, AT_D890_FW_TIMEOUT_MS.END))[0]!;
          if (r !== AT_D890_FW_ACK) {
            throw new RadioProtocolError(
              `After the end byte the radio replied ${r.toString(16).padStart(2, '0')}, not 06.`,
            );
          }
          end = 'acknowledged';
        } catch (err) {
          if (err instanceof RadioClosedError) end = 'port-closed-by-radio';
          else if (err instanceof RadioTimeoutError) end = 'no-reply';
          else throw err;
        }

        const result: FirmwareFlashResult = {
          framesSent: framesSent + 2,
          dataFrames: total,
          elapsedMs: Date.now() - started,
          end,
          timing: summariseD890FrameTiming(samples, timed),
        };
        emit(total, total, 'finish', 'Finished');
        return result;
      } catch (err) {
        throw new FirmwareFlashError({
          cause: err,
          radioTouched,
          position,
          timing: samples ? summariseD890FrameTiming(samples, timed) : undefined,
        });
      }
    },
  };
}
