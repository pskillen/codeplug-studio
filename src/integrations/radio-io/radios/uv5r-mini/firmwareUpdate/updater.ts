/**
 * UV-5R Mini firmware updater: the host half of a radio-driven protocol. The radio (its app, then its loader) asks for
 * slices of the checked image and Studio answers each one from the image bytes; `session.ts` holds every rule, this file
 * holds the clock, the link and the operator's words. Port of the firmware project's host tool.
 *
 * Every byte written goes through the one `createGuardedSend` below, with `checkUv5rMiniOutgoing` as the check, so only
 * a ping, a rate, a slice of the image or an echo of the radio's own result and length can leave.
 *
 * Link: 9600 baud with DTR and RTS low. The app's update stage runs at 9600; on the loader's first hello the reply goes
 * out at 9600 and the link is reopened at 38400 (`BytePipe.reopen`).
 */
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';

import { FirmwareFlashError } from '../../../firmware/errors.ts';
import { createGuardedSend } from '../../../firmware/guardedSend.ts';
import type {
  FirmwareBootloaderIdent,
  FirmwareFlashPhase,
  FirmwareFlashProgress,
  FirmwareFlashResult,
  FirmwareUpdater,
} from '../../../firmware/types.ts';
import {
  RadioAlreadyInstalledError,
  RadioClosedError,
  RadioInterlockError,
  RadioNoResponseError,
  RadioNothingInstalledError,
  RadioProtocolError,
  RadioTimeoutError,
} from '../../../kit/errors.ts';
import { throwIfAborted } from '../../../kit/progress.ts';
import type { BytePipe } from '../../../types.ts';
import {
  UV5RMINI_FW_LINK,
  UV5RMINI_FW_RADIO_ID,
  UV5RMINI_FW_ROLE,
  UV5RMINI_FW_TIMEOUT_MS,
} from './constants.ts';
import {
  encodeUv5rMiniFrame,
  Uv5rMiniFrameParser,
  UV5RMINI_FW_CMD,
  UV5RMINI_FW_APP_BAUD,
} from './frames.ts';
import {
  checkUv5rMiniImage,
  isUv5rMiniToStockImage,
  UV5RMINI_BACK_TO_STOCK,
} from './interlocks.ts';
import { checkUv5rMiniOutgoing } from './outgoing.ts';
import { createUv5rMiniSession, type Uv5rMiniReply, type Uv5rMiniSession } from './session.ts';

const MODEL = 'UV-5R Mini';

export const UV5RMINI_MSG = {
  continuing:
    'Your radio was part-way through an update. Studio is continuing it. Keep the cable in and the battery charged.',
  noAnswer:
    'No radio in update mode answered. Nothing was sent that the radio acted on. Switch the radio off, put it into update mode again and try again.',
  appStopped:
    'The radio stopped answering before its firmware was touched. Nothing was written to the firmware. Switch the radio off and on, then press Connect and flash again.',
  appRefused: 'Nothing was written to the firmware. Switch the radio off and on.',
  appOtherLayout:
    "Nothing was written to the firmware: the radio refused this file before installing anything, most likely because it isn't for this radio's firmware. Its FM presets and volume may have been reset; nothing else changed.",
  appKey: " This image is not for this radio's key.",
  appOtherStock: ' This image is for another stock version.',
  loaderAlready:
    "This firmware is already on the radio, or the radio holds firmware this image can't replace. Nothing was erased.",
  loaderFinished:
    'The interrupted update had already finished. The radio restarts into the new firmware. Check the name; if it is missing, the radio needs a case-open repair.',
  loaderOtherLayout:
    "The file isn't for this radio's firmware; the radio refused it. Its FM presets and volume may have been reset; nothing else changed.",
  loaderNothingWritten: 'Nothing was written; the radio boots the installed app.',
  loaderNothingWrittenAgain:
    " Don't send this file again: it can only end the same way. If the radio doesn't reach its normal screen, it needs a case-open repair.",
  recover:
    'Recover the radio: leave the cable in, switch the radio off and on with no keys held, then press Connect and flash again with the same files.',
  alreadyHad: 'The radio already had this firmware.',
  alreadyInstalledRun:
    "This firmware is already installed: the radio's loader found nothing to replace. Nothing was written to the firmware; Studio sent nothing more. Switch the radio off and on, and it boots the installed app. Flash a different build, not this one again.",
} as const;

const hex2 = (n: number) => `0x${n.toString(16).toUpperCase().padStart(2, '0')}`;

/** A mutable view for the one guarded send path: the image is only known once `flash()` runs. */
interface OutgoingContext {
  image: Uint8Array;
  lastRadioData: (cmd: number) => Uint8Array | undefined;
}

interface Heard {
  readonly cmd: number;
  readonly data: Uint8Array;
}

/** Bytes in, whole good frames out, with timeouts and abort checks in short slices. */
class FrameReader {
  private parser = new Uv5rMiniFrameParser();
  private queue: Heard[] = [];
  badCrc: string[] = [];

  constructor(
    private readonly pipe: BytePipe,
    private readonly signal: AbortSignal | undefined,
  ) {}

  /** Forget everything heard so far (after a rate change nothing earlier is valid). */
  reset(): void {
    this.queue = [];
    // Bytes of a half-read frame at the old rate are meaningless.
    this.parser = new Uv5rMiniFrameParser();
  }

  /** The next good frame, or null when `timeoutMs` passes with none. */
  async next(timeoutMs: number): Promise<Heard | null> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const queued = this.queue.shift();
      if (queued) return queued;
      throwIfAborted(this.signal);
      const left = deadline - Date.now();
      if (left <= 0) return null;
      let first: Uint8Array;
      try {
        first = await this.pipe.readExact(1, Math.min(UV5RMINI_FW_TIMEOUT_MS.SLICE, left));
      } catch (err) {
        if (err instanceof RadioTimeoutError) continue;
        throw err;
      }
      const rest = (await this.pipe.drain?.()) ?? new Uint8Array(0);
      const bytes = new Uint8Array(first.length + rest.length);
      bytes.set(first, 0);
      bytes.set(rest, first.length);
      for (const e of this.parser.feed(bytes)) {
        if (e.kind === 'frame') this.queue.push({ cmd: e.cmd, data: e.data });
        else this.badCrc.push(e.hex);
      }
    }
  }
}

interface BoundSession {
  readonly pipe: BytePipe;
  readonly reader: FrameReader;
  readonly ctx: OutgoingContext;
  readonly send: (frame: Uint8Array) => Promise<void>;
  /** What identify heard: the loader's own cmd 1 (an earlier update was cut) or the app's pong. */
  readonly mode: 'loader' | 'app';
  readonly raw: Uint8Array;
  writes: number;
}

export function createUv5rMiniFirmwareUpdater(): FirmwareUpdater {
  let bound: BoundSession | null = null;

  return {
    radioId: UV5RMINI_FW_RADIO_ID,
    link: UV5RMINI_FW_LINK,

    checkImage(image: PreparedFirmwareImage): void {
      checkUv5rMiniImage(image);
    },

    async identify(pipe, opts) {
      bound = null;
      const reader = new FrameReader(pipe, opts?.signal);
      const ctx: OutgoingContext = { image: new Uint8Array(0), lastRadioData: () => undefined };
      // The one write site: every frame, in identify and in flash, is checked here.
      const send = createGuardedSend(pipe, (f) => checkUv5rMiniOutgoing(f, ctx));
      let where = 'listen';

      try {
        await pipe.flush?.();

        // Listen first, send nothing: a loader restarted from its record talks first, at the app rate.
        const listenUntil = Date.now() + UV5RMINI_FW_TIMEOUT_MS.LISTEN;
        for (;;) {
          const left = listenUntil - Date.now();
          if (left <= 0) break;
          const heard = await reader.next(left);
          if (!heard) break;
          if (heard.cmd === UV5RMINI_FW_CMD.BAUD && heard.data.length === 0) {
            const raw = encodeUv5rMiniFrame(UV5RMINI_FW_CMD.BAUD);
            bound = { pipe, reader, ctx, send, mode: 'loader', raw, writes: 0 };
            const ident: FirmwareBootloaderIdent = {
              radioId: UV5RMINI_FW_RADIO_ID,
              model: MODEL,
              version: 'update in progress',
              raw,
              notice: UV5RMINI_MSG.continuing,
            };
            return ident;
          }
        }

        where = 'ping';
        // Silence: ping once a second until the app answers with an empty cmd 1.
        const pingUntil = Date.now() + UV5RMINI_FW_TIMEOUT_MS.PING_TOTAL;
        let pings = 0;
        while (Date.now() < pingUntil) {
          throwIfAborted(opts?.signal);
          await send(encodeUv5rMiniFrame(UV5RMINI_FW_CMD.PING));
          pings += 1;
          const until = Date.now() + UV5RMINI_FW_TIMEOUT_MS.PING_INTERVAL;
          for (;;) {
            const left = until - Date.now();
            if (left <= 0) break;
            const heard = await reader.next(left);
            if (!heard) break;
            if (heard.cmd !== UV5RMINI_FW_CMD.BAUD || heard.data.length !== 0) continue;
            if (pings > 1) {
              // Earlier pings are answered too; let those pongs arrive now, not after the first read, where an empty
              // cmd 1 means the app has handed over to the loader.
              const settleUntil = Date.now() + UV5RMINI_FW_TIMEOUT_MS.PONG_SETTLE;
              while (Date.now() < settleUntil) {
                if (!(await reader.next(settleUntil - Date.now()))) break;
              }
            }
            const raw = encodeUv5rMiniFrame(UV5RMINI_FW_CMD.BAUD);
            bound = { pipe, reader, ctx, send, mode: 'app', raw, writes: pings };
            const ident: FirmwareBootloaderIdent = {
              radioId: UV5RMINI_FW_RADIO_ID,
              model: MODEL,
              version: 'update mode',
              raw,
            };
            return ident;
          }
        }
        throw new FirmwareFlashError({
          cause: new RadioNoResponseError(UV5RMINI_MSG.noAnswer),
          radioTouched: false,
          position: 'ping',
        });
      } catch (err) {
        if (err instanceof FirmwareFlashError) throw err;
        throw new FirmwareFlashError({
          cause: err,
          radioTouched: false,
          position: where,
        });
      }
    },

    async flash(image, flashOpts) {
      const started = Date.now();
      const session0 = bound;
      // One flash per identify: a retry must connect and identify again.
      bound = null;
      let radioTouched = false;
      let position = 'checks';
      let session: Uv5rMiniSession | null = null;

      const positionOf = (s: Uv5rMiniSession): string =>
        s.phase === 'loader'
          ? `loader#${s.reads}`
          : s.phase === 'done'
            ? 'result'
            : `app#${s.reads}`;

      try {
        if (!session0) {
          throw new RadioProtocolError('The radio has not been identified in this session.');
        }
        const { pipe, reader, ctx, send, mode } = session0;
        if (!pipe.reopen) {
          throw new RadioProtocolError(
            'This connection cannot change the line rate, which the UV-5R Mini update needs. Nothing was sent.',
          );
        }
        // Re-runs every image interlock before the first frame of the update leaves.
        checkUv5rMiniImage(image);
        const bytes = image.package.files[UV5RMINI_FW_ROLE];
        if (!bytes)
          throw new RadioInterlockError('The image has no update file. Nothing was sent.');

        const s = createUv5rMiniSession(bytes);
        session = s;
        ctx.image = bytes;
        ctx.lastRadioData = (cmd) => s.lastRadioData(cmd);

        let linkRate = UV5RMINI_FW_APP_BAUD;
        let frames = session0.writes;
        let dataFrames = 0;
        let seen = 0;
        // Distinct bytes the loader has read, not the sum of its reads: on a slow host it can ask for a block twice.
        const covered = createCoveredBytes();

        const emit = (cur: number, max: number, phase: FirmwareFlashPhase, msg: string) => {
          const update: FirmwareFlashProgress = {
            cur,
            max,
            msg,
            stage: phase,
            phase,
            radioTouched,
            ...(max > 0 ? { written: { done: cur, total: max, unit: 'bytes' as const } } : {}),
          };
          flashOpts.onProgress?.(update);
        };

        let progressPhase: FirmwareFlashPhase = 'handshake';
        emit(0, 0, 'handshake', 'Handshake with the radio');

        const noteEvents = () => {
          for (; seen < s.events.length; seen++) {
            const e = s.events[seen]!;
            switch (e.kind) {
              case 'loader-first':
              case 'handover':
                // The loader is running: from here a stop can leave the radio needing a re-flash.
                radioTouched = true;
                // Not an erase: the loader has said hello and nothing more. Erase is shown at its cmd 4.
                progressPhase = 'loader';
                emit(0, 0, 'loader', "The radio's loader is running");
                break;
              case 'length':
                progressPhase = e.len === 0 ? 'finish' : 'erase';
                emit(
                  0,
                  e.len,
                  progressPhase,
                  e.len === 0
                    ? 'The radio already has this firmware'
                    : 'The radio is erasing its firmware area',
                );
                break;
              case 'read':
                if (s.areaLength !== undefined && s.areaLength > 0 && e.inImage) {
                  covered.add(e.off, e.len);
                  progressPhase = 'transfer';
                  emit(
                    Math.min(covered.total(), s.areaLength),
                    s.areaLength,
                    'transfer',
                    'Sending the firmware',
                  );
                }
                break;
              case 'result':
                progressPhase = 'finish';
                emit(
                  Math.min(covered.total(), s.areaLength ?? 0),
                  s.areaLength ?? 0,
                  'finish',
                  'Finishing',
                );
                break;
              default:
                break;
            }
          }
        };

        const answer = async (reply: Uv5rMiniReply) => {
          if (reply.flagged) {
            // Still refused, and nothing more is sent; only the words differ. `alreadyInstalled` is reachable only with
            // a list-carrying loader: the always-write L1/L2 loaders plan the whole area every time, so they never
            // report it.
            if (reply.alreadyInstalled) {
              throw new RadioAlreadyInstalledError(UV5RMINI_MSG.alreadyInstalledRun);
            }
            throw new RadioInterlockError(
              `UV-5R Mini updater: ${reply.flagged}. Nothing more was sent.`,
            );
          }
          if (reply.rate !== linkRate) {
            throw new RadioProtocolError(
              `The reply is due at ${reply.rate} baud but the link is at ${linkRate}.`,
            );
          }
          for (const frame of reply.frames) {
            await send(frame);
            frames += 1;
            if (frame[4] === UV5RMINI_FW_CMD.DATA) dataFrames += 1;
          }
          if (reply.switchTo !== undefined) {
            // The reply has left at the old rate. Reopen at the new one; anything read before is dropped.
            await pipe.reopen!(reply.switchTo);
            linkRate = reply.switchTo;
            reader.reset();
          }
        };

        // Hand identify's frame to the session, as if it had arrived now.
        position = mode === 'loader' ? 'loader#0' : 'app#0';
        if (mode === 'app') s.ping();
        await answer(s.onFrame(UV5RMINI_FW_CMD.BAUD, new Uint8Array(0)));
        noteEvents();

        while (!s.done) {
          throwIfAborted(flashOpts.signal);
          position = positionOf(s);
          const heard = await reader.next(UV5RMINI_FW_TIMEOUT_MS.IDLE);
          if (!heard) {
            throw new RadioTimeoutError(
              `No frame from the radio for ${UV5RMINI_FW_TIMEOUT_MS.IDLE / 1000} seconds.`,
            );
          }
          await answer(s.onFrame(heard.cmd, heard.data));
          noteEvents();
          for (const hex of reader.badCrc.splice(0)) s.noteBadCrc(hex);
        }

        const outcome = describeUv5rMiniResult(s, image);
        if (outcome.error) {
          // A refusal before anything was installed is typed, so the wizard shows "nothing was installed" (and may
          // offer the other layout's file) rather than "recover the radio", even though the loader ran.
          throw outcome.nothingInstalled
            ? new RadioNothingInstalledError(outcome.error)
            : new RadioProtocolError(outcome.error);
        }
        const result: FirmwareFlashResult = {
          framesSent: frames,
          dataFrames,
          elapsedMs: Date.now() - started,
          end: 'acknowledged',
          note: outcome.note,
        };
        emit(Math.min(covered.total(), s.areaLength ?? 0), s.areaLength ?? 0, 'finish', 'Finished');
        return result;
      } catch (err) {
        const cause = err;
        const message = session ? stallMessage(err, session) : undefined;
        throw new FirmwareFlashError({
          cause,
          radioTouched,
          position: session ? positionOf(session) : position,
          message,
        });
      }
    },
  };
}

/** The wording for a stopped session: a timeout in the loader (or after cmd 4) is the recover text. */
function stallMessage(err: unknown, s: Uv5rMiniSession): string | undefined {
  if (err instanceof RadioTimeoutError || err instanceof RadioClosedError) {
    return s.phase === 'loader' ? UV5RMINI_MSG.recover : UV5RMINI_MSG.appStopped;
  }
  return undefined;
}

/**
 * A finished session as the operator's words: a note for a clean end, an error text for anything else.
 * `nothingInstalled` marks the two refusals that say the file is for the other flash layout and that nothing was
 * installed: the loader's `0x8F` (always before cmd 4) and the app's `0x83` with no cmd 4 heard in the session.
 */
export function describeUv5rMiniResult(
  s: Pick<Uv5rMiniSession, 'result' | 'resultPhase' | 'areaLength' | 'continued' | 'lengthHeard'>,
  image: PreparedFirmwareImage,
): { note?: string; error?: string; nothingInstalled?: true } {
  const code = s.result;
  const name = image.versionStamp ?? image.title;
  if (s.resultPhase === 'loader') {
    if (code === 0) {
      const restart = isUv5rMiniToStockImage(image)
        ? `The radio restarts by itself, ${UV5RMINI_BACK_TO_STOCK}. ${image.verifyHint}`
        : `The radio restarts by itself. Check the power-on screen shows ${name}.`;
      return {
        note: s.areaLength === 0 ? `${UV5RMINI_MSG.alreadyHad} ${restart}` : restart,
      };
    }
    if (s.areaLength !== undefined)
      return { error: `${UV5RMINI_MSG.recover} (Result ${hex2(code ?? 0)}.)` };
    if (code === 0x86) {
      return { error: s.continued ? UV5RMINI_MSG.loaderFinished : UV5RMINI_MSG.loaderAlready };
    }
    // 0x8F: the layout loader's check found the radio's installed layout is not its own. It refuses before cmd 4, but
    // the stock app's update stage has already cleared the settings sector holding the FM presets and volume.
    if (code === 0x8f) return { error: UV5RMINI_MSG.loaderOtherLayout, nothingInstalled: true };
    // 0x87 before cmd 4: the loader erased and programmed nothing, and the radio boots its installed app.
    if (code === 0x87) {
      return {
        error: s.continued
          ? UV5RMINI_MSG.loaderNothingWritten + UV5RMINI_MSG.loaderNothingWrittenAgain
          : UV5RMINI_MSG.loaderNothingWritten,
      };
    }
    return {
      error: `The radio's loader refused the image (result ${hex2(code ?? 0)}). Nothing was erased.`,
    };
  }
  // The app stage ended with a result: nothing reached the firmware. Its 0x83 before any cmd 4 is the other layout's
  // refusal; after a cmd 4 (which the app stage ignores) it keeps today's words.
  if (code === 0x83 && !s.lengthHeard) {
    return { error: UV5RMINI_MSG.appOtherLayout, nothingInstalled: true };
  }
  let text = UV5RMINI_MSG.appRefused;
  if (code === 0x01) text += UV5RMINI_MSG.appKey;
  else if (code === 0x8a) text += UV5RMINI_MSG.appOtherStock;
  else if (code !== 0x86 && code !== 0x83) text += ` (Result ${hex2(code ?? 0)}.)`;
  return { error: text };
}

/** The union of byte ranges read so far, for the progress count. Reads arrive in order, so the list stays short. */
export function createCoveredBytes(): { add(off: number, len: number): void; total(): number } {
  const ranges: [number, number][] = [];
  let sum = 0;
  return {
    add(off, len) {
      if (len <= 0) return;
      let start = off;
      let end = off + len;
      const kept: [number, number][] = [];
      for (const [a, b] of ranges) {
        if (b < start || a > end) kept.push([a, b]);
        else {
          start = Math.min(start, a);
          end = Math.max(end, b);
        }
      }
      kept.push([start, end]);
      kept.sort((x, y) => x[0] - y[0]);
      ranges.length = 0;
      ranges.push(...kept);
      sum = ranges.reduce((n, [a, b]) => n + (b - a), 0);
    },
    total: () => sum,
  };
}
