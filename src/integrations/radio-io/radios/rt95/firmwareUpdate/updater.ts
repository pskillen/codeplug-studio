/**
 * RT95 front panel firmware updater: a port of `Sender` in the firmware project's `tools/rt95update.py`.
 * Every byte goes through `createGuardedSend` (the only write site) with `checkRt95HeadOutgoing` as the guard.
 * The bootloader has no ident, so there is nothing to compare against the package: the pre-flight gate and the
 * operator's choice of key combination decide which MCU listens (see preflight.ts).
 * Up to 3 resends per frame (the vendor resends forever); a final failure aborts and nothing more is sent.
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
import { RadioClosedError, RadioProtocolError, RadioTimeoutError } from '../../../kit/errors.ts';
import { throwIfAborted } from '../../../kit/progress.ts';
import type { BytePipe } from '../../../types.ts';
import {
  RT95_HEAD_FW_ACK,
  RT95_HEAD_FW_CLONE_END,
  RT95_HEAD_FW_END,
  RT95_HEAD_FW_HANDSHAKE_TRIES,
  RT95_HEAD_FW_LINK,
  RT95_HEAD_FW_PROGRAM,
  RT95_HEAD_FW_RESENDS,
  RT95_HEAD_FW_TIMEOUT_MS,
} from './constants.ts';
import { createEchoChannel, type Rt95EchoChannel } from './echo.ts';
import { makeRt95UpdateFrame } from './frames.ts';
import {
  RT95_HEAD_FW_RADIO_ID,
  checkRt95HeadFirmwareImage,
  checkRt95HeadOutgoing,
  type Rt95OutgoingState,
} from './interlocks.ts';
import { rt95HeadBlockCount, rt95HeadBlocks } from './package.ts';

const END_BYTE = Uint8Array.of(RT95_HEAD_FW_END);
const NOT_IN_UPDATE_MODE =
  "The radio didn't answer. Is it in update mode? Hold P1 and the knob while switching on; the screen stays blank.";

const hexBytes = (b: ArrayLike<number>) =>
  Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(' ');
const hex32 = (a: number) => `0x${a.toString(16).toUpperCase().padStart(8, '0')}`;
const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Median, p99 and max of the first `count` samples. */
export function summariseRt95FrameTiming(
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
  readonly echo: Rt95EchoChannel;
  /** Counts every write that reached the pipe, from the handshake on. */
  readonly writes: { count: number };
}

async function readByte(pipe: BytePipe, timeoutMs: number): Promise<number | null> {
  try {
    return (await pipe.readExact(1, timeoutMs))[0]!;
  } catch (err) {
    if (err instanceof RadioTimeoutError) return null;
    throw err;
  }
}

export function createRt95HeadFirmwareUpdater(): FirmwareUpdater {
  let session: BoundSession | null = null;

  return {
    radioId: RT95_HEAD_FW_RADIO_ID,
    link: RT95_HEAD_FW_LINK,

    checkImage(image: PreparedFirmwareImage): void {
      checkRt95HeadFirmwareImage(image);
    },

    async identify(pipe, identifyOpts) {
      session = null;
      const gate: Rt95OutgoingState = { cloneEndAllowed: false };
      const guarded = createGuardedSend(pipe, (f) => checkRt95HeadOutgoing(f, gate));
      const writes = { count: 0 };
      const send = async (frame: Uint8Array) => {
        await guarded(frame);
        writes.count += 1;
      };
      const echo = createEchoChannel(pipe, send);
      const raw: number[] = [];
      const take = async (n: number, timeoutMs: number) => {
        const got = await pipe.readExact(n, timeoutMs);
        raw.push(...got);
        return got;
      };

      await pipe.flush?.();
      for (let attempt = 0; attempt < RT95_HEAD_FW_HANDSHAKE_TRIES; attempt++) {
        throwIfAborted(identifyOpts?.signal);
        await send(RT95_HEAD_FW_PROGRAM);
        let reply: number | null;
        try {
          const first = await readByte(pipe, RT95_HEAD_FW_TIMEOUT_MS.HANDSHAKE);
          if (first === null) reply = null;
          else if (first === RT95_HEAD_FW_PROGRAM[0]) {
            // The line echoes: the rest of PROGRAM comes back before the reply.
            raw.push(first);
            const rest = await take(
              RT95_HEAD_FW_PROGRAM.length - 1,
              RT95_HEAD_FW_TIMEOUT_MS.HANDSHAKE,
            );
            if (!rest.every((b, i) => b === RT95_HEAD_FW_PROGRAM[i + 1])) {
              throw new RadioProtocolError(
                'The cable echo did not match what Studio sent. Nothing more was sent. Check the cable and try again.',
              );
            }
            echo.setMode('echo');
            reply = await readByte(pipe, RT95_HEAD_FW_TIMEOUT_MS.HANDSHAKE);
            if (reply !== null) raw.push(reply);
          } else {
            raw.push(first);
            echo.setMode('none');
            reply = first;
          }
        } catch (err) {
          if (err instanceof RadioTimeoutError) reply = null;
          else throw err;
        }

        if (reply === null) {
          await pipe.flush?.();
          continue;
        }
        if (reply === RT95_HEAD_FW_ACK) {
          session = { pipe, echo, writes };
          const ident: FirmwareBootloaderIdent = {
            radioId: RT95_HEAD_FW_RADIO_ID,
            model: 'RT95 bootloader (no ident)',
            raw: Uint8Array.from(raw),
          };
          return ident;
        }
        if (reply === 0x51) {
          // 'Q': the head app's PC link answered `QX 06`. The radio is switched on normally.
          for (let i = 0; i < 2; i++) {
            const b = await readByte(pipe, RT95_HEAD_FW_TIMEOUT_MS.HANDSHAKE);
            if (b === null) break;
            raw.push(b);
          }
          gate.cloneEndAllowed = true;
          try {
            await send(RT95_HEAD_FW_CLONE_END);
          } finally {
            gate.cloneEndAllowed = false;
          }
          throw new RadioProtocolError(
            'The radio is switched on normally, not in update mode. Nothing was written. Switch it off, then hold P1 and the knob while switching on; the screen stays blank.',
          );
        }
        throw new RadioProtocolError(
          `Unexpected reply to the update request: ${hexBytes(raw)}. Nothing was written.`,
        );
      }
      throw new RadioProtocolError(NOT_IN_UPDATE_MODE);
    },

    async flash(image, flashOpts) {
      const started = Date.now();
      let radioTouched = false;
      let position = 'checks';
      let samples: Float64Array | null = null;
      let timed = 0;
      const bound = session;
      // One flash per identify: a retry must re-enter update mode and identify again.
      session = null;
      try {
        if (!bound) {
          throw new RadioProtocolError('The bootloader has not been identified in this session.');
        }
        const pkg = checkRt95HeadFirmwareImage(image);
        const { pipe, echo } = bound;

        const total = rt95HeadBlockCount(pkg);
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

        // The bootloader answered PROGRAM in identify(); report the handshake as done before the transfer.
        emit(0, total, 'handshake', 'Handshake');
        let n = 0;
        for (const { addr, data } of rt95HeadBlocks(pkg)) {
          position = `frame ${n + 1}/${total} @ ${hex32(addr)}`;
          // Abort checks sit between frames only, never mid-frame.
          throwIfAborted(flashOpts.signal);
          const frame = makeRt95UpdateFrame(addr, data);
          if (!radioTouched) {
            radioTouched = true;
            emit(0, total, 'transfer', `Transfer 0/${total}`);
          }
          const timeoutMs =
            n === 0 ? RT95_HEAD_FW_TIMEOUT_MS.FIRST_FRAME : RT95_HEAD_FW_TIMEOUT_MS.FRAME;
          const t0 = now();
          let last: number | null = null;
          for (let attempt = 0; attempt < 1 + RT95_HEAD_FW_RESENDS; attempt++) {
            try {
              await echo.writeChecked(frame, timeoutMs);
              last = await readByte(pipe, timeoutMs);
            } catch (err) {
              // A silent line is a missing reply; a wrong echo (protocol error) stops the session.
              if (!(err instanceof RadioTimeoutError)) throw err;
              last = null;
            }
            if (last === RT95_HEAD_FW_ACK) break;
            await pipe.flush?.();
          }
          if (last !== RT95_HEAD_FW_ACK) {
            throw new RadioProtocolError(
              `The radio did not accept ${position} after ${1 + RT95_HEAD_FW_RESENDS} attempts (last reply ${last === null ? 'nothing' : last.toString(16).padStart(2, '0')}).`,
            );
          }
          samples[timed++] = now() - t0;
          n += 1;
          emit(n, total, 'transfer', `Transfer ${n}/${total}`);
        }

        position = 'end';
        throwIfAborted(flashOpts.signal);
        emit(total, total, 'finish', 'Finishing');
        let end: FirmwareFlashEnd;
        try {
          await echo.writeChecked(END_BYTE, RT95_HEAD_FW_TIMEOUT_MS.END);
          const r = (await pipe.readExact(1, RT95_HEAD_FW_TIMEOUT_MS.END))[0]!;
          if (r !== RT95_HEAD_FW_ACK) {
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
          // Every write: each PROGRAM, each data send including resends, and `18`.
          framesSent: bound.writes.count,
          dataFrames: total,
          elapsedMs: Date.now() - started,
          end,
          timing: summariseRt95FrameTiming(samples, timed),
        };
        emit(total, total, 'finish', 'Finished');
        return result;
      } catch (err) {
        throw new FirmwareFlashError({
          cause: err,
          radioTouched,
          position,
          timing: samples ? summariseRt95FrameTiming(samples, timed) : undefined,
        });
      }
    },
  };
}
