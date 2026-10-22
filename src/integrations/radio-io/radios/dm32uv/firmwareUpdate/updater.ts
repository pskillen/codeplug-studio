/**
 * DM-32UV firmware updater: a port of `Session` in the firmware project's `tools/flash/dm32_fw_send.py`.
 * The dialect has no NAK, no resend and no resume: any deviation aborts at once and nothing is retried.
 * Every byte goes through `createGuardedSend` (the only write site) with a guard that allows exactly the next
 * precomputed frame.
 */
import {
  DM32UV_FIRMWARE_BLOCK0_FILE_NAME,
  DM32UV_FIRMWARE_MODEL_ID,
} from '@core/radios/baofeng/dm-32uv/firmware.ts';
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';

import { FirmwareFlashError } from '../../../firmware/errors.ts';
import { createGuardedSend } from '../../../firmware/guardedSend.ts';
import type {
  FirmwareBootloaderIdent,
  FirmwareFlashEnd,
  FirmwareFlashPhase,
  FirmwareFlashProgress,
  FirmwareFlashResult,
  FirmwareUpdater,
} from '../../../firmware/types.ts';
import {
  RadioClosedError,
  RadioInterlockError,
  RadioProtocolError,
  RadioTimeoutError,
  RadioWrongIdentError,
} from '../../../kit/errors.ts';
import { throwIfAborted } from '../../../kit/progress.ts';
import type { BytePipe } from '../../../types.ts';
import { DM32_FW_LINK, DM32_FW_PRE_SEND_DELAY_MS, DM32_FW_TIMEOUT_MS } from './constants.ts';
import {
  checkDm32FirmwareImage,
  createDm32TxGuard,
  DM32_FW_RADIO_ID,
  dm32BytesEqual,
} from './interlocks.ts';
import {
  buildDm32FirmwarePlan,
  buildDm32IdentSteps,
  DM32_PRELUDE_IDENT_STEPS,
  type Dm32PlanStep,
} from './plan.ts';

export interface Dm32FirmwareUpdaterOptions {
  /** Delay after the RX flush and before each write (the CPS's ComWrite). Tests pass 0. */
  readonly preSendDelayMs?: number;
  readonly eraseTimeoutMs?: number;
}

/** Progress is emitted on each phase change and every this many data blocks. */
const PROGRESS_EVERY_BLOCKS = 8;

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(' ');

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
}

interface BoundSession {
  readonly pipe: BytePipe;
  readonly ident: FirmwareBootloaderIdent;
  readonly identSteps: readonly Dm32PlanStep[];
}

export function createDm32FirmwareUpdater(opts: Dm32FirmwareUpdaterOptions = {}): FirmwareUpdater {
  const preSendDelayMs = opts.preSendDelayMs ?? DM32_FW_PRE_SEND_DELAY_MS;
  const eraseTimeoutMs = opts.eraseTimeoutMs ?? DM32_FW_TIMEOUT_MS.ERASE;
  let session: BoundSession | null = null;

  return {
    radioId: DM32_FW_RADIO_ID,
    link: DM32_FW_LINK,

    checkImage(image: PreparedFirmwareImage): void {
      checkDm32FirmwareImage(image);
    },

    async identify(pipe, identifyOpts) {
      session = null;
      const steps = buildDm32IdentSteps();
      const guard = createDm32TxGuard(steps);
      const send = createGuardedSend(pipe, (frame) => guard.check(frame));
      let raw: Uint8Array = new Uint8Array(0);
      for (const step of steps) {
        throwIfAborted(identifyOpts?.signal);
        await pipe.flush?.();
        await sleep(preSendDelayMs);
        await send(step.tx);
        const rx = await pipe.readExact(step.rx!.length, step.timeoutMs);
        if (!dm32BytesEqual(rx, step.rx!)) {
          if (step.name === 'model-query') {
            throw new RadioWrongIdentError(
              `Bootloader model reply was ${hex(rx)}, expected ${hex(step.rx!)}. Is the radio in update mode?`,
            );
          }
          if (step.name === 'model-id') {
            throw new RadioWrongIdentError(
              `The bootloader reported a different model, not ${DM32UV_FIRMWARE_MODEL_ID}.`,
            );
          }
          throw new RadioProtocolError(
            'The radio did not answer like a DM-32UV in update mode. Check it is in update mode.',
          );
        }
        if (step.name === 'model-id') raw = rx;
        guard.advance();
      }
      const ident: FirmwareBootloaderIdent = {
        radioId: DM32_FW_RADIO_ID,
        model: DM32UV_FIRMWARE_MODEL_ID,
        raw,
      };
      session = { pipe, ident, identSteps: steps };
      return ident;
    },

    async flash(image, flashOpts) {
      const started = Date.now();
      let radioTouched = false;
      let position = 'not started';
      let framesSent = 0;
      const bound = session;
      // One flash per identify: a retry must re-enter update mode and identify again.
      session = null;
      try {
        if (!bound) {
          throw new RadioProtocolError('The bootloader has not been identified in this session.');
        }
        const bin = checkDm32FirmwareImage(image);
        if (!dm32BytesEqual(bin.subarray(0, bound.ident.raw.length), bound.ident.raw)) {
          throw new RadioInterlockError(
            'The firmware image is for a different model than the bootloader reported.',
          );
        }
        const plan = buildDm32FirmwarePlan(bin, DM32UV_FIRMWARE_BLOCK0_FILE_NAME, eraseTimeoutMs);
        for (let i = 0; i < DM32_PRELUDE_IDENT_STEPS; i++) {
          if (!dm32BytesEqual(plan[i]!.tx, bound.identSteps[i]!.tx)) {
            throw new RadioInterlockError('The firmware plan does not start with the sent ident.');
          }
        }

        const { pipe } = bound;
        // The guard snapshots the plan: any later change to a frame is refused.
        const guard = createDm32TxGuard(plan, DM32_PRELUDE_IDENT_STEPS);
        const send = createGuardedSend(pipe, (frame) => guard.check(frame));
        const dataFrames = plan.filter((s) => s.name.startsWith('block#')).length;
        let lastPhase: FirmwareFlashPhase | null = null;
        let blocksDone = 0;
        let end: FirmwareFlashEnd = 'eot-sent';

        const emit = (index: number, phase: FirmwareFlashPhase, msg: string) => {
          const update: FirmwareFlashProgress = {
            cur: index,
            max: plan.length,
            msg,
            stage: phase,
            phase,
            radioTouched,
          };
          flashOpts.onProgress?.(update);
        };

        for (let i = DM32_PRELUDE_IDENT_STEPS; i < plan.length; i++) {
          const step = plan[i]!;
          position = step.name;
          if (step.phase !== lastPhase) {
            lastPhase = step.phase;
            emit(i, step.phase, phaseMessage(step.phase, blocksDone, dataFrames));
          }
          // Abort checks sit between frames only, never mid-frame.
          throwIfAborted(flashOpts.signal);
          await pipe.flush?.();
          await sleep(preSendDelayMs);
          if (step.touchesRadio) radioTouched = true;
          await send(step.tx);
          framesSent += 1;

          if (step.rx === null) {
            // EOT: read one byte and ignore it, as the CPS does. Silence is fine.
            try {
              await pipe.readExact(1, step.timeoutMs);
            } catch (err) {
              if (err instanceof RadioClosedError) end = 'port-closed-by-radio';
              else if (!(err instanceof RadioTimeoutError)) throw err;
            }
            guard.advance();
            break;
          }
          const rx = await pipe.readExact(step.rx.length, step.timeoutMs);
          if (!dm32BytesEqual(rx, step.rx)) {
            throw new RadioProtocolError(
              `The radio refused ${step.name}: expected ${hex(step.rx)}, got ${hex(rx) || 'nothing'}.`,
            );
          }
          guard.advance();
          if (step.name.startsWith('block#')) {
            blocksDone += 1;
            if (blocksDone % PROGRESS_EVERY_BLOCKS === 0 || blocksDone === dataFrames) {
              emit(i + 1, 'transfer', phaseMessage('transfer', blocksDone, dataFrames));
            }
          }
        }

        const result: FirmwareFlashResult = {
          framesSent: framesSent + DM32_PRELUDE_IDENT_STEPS,
          dataFrames,
          elapsedMs: Date.now() - started,
          end,
        };
        emit(plan.length, 'finish', 'Finished');
        return result;
      } catch (err) {
        throw new FirmwareFlashError({ cause: err, radioTouched, position });
      }
    },
  };
}

function phaseMessage(phase: FirmwareFlashPhase, blocksDone: number, dataFrames: number): string {
  switch (phase) {
    case 'handshake':
      return 'Handshake';
    case 'erase':
      return 'Erasing';
    case 'transfer':
      return `Transfer ${blocksDone}/${dataFrames}`;
    case 'finish':
      return 'Finishing';
  }
}
