/**
 * AT-D890UV range change session.
 *
 * Called with the radio already in PROGRAM (the wizard's session A). Reads LocalInfo, checks it is still the
 * backed-up one and has no stun/kill flag, builds the frame, lets the caller write its journal, sends the one
 * `W`, and only then sends `END` (which makes the firmware commit and reboot).
 *
 * Two facts about every failure, kept apart: `frameSent` (a `W` may have reached the radio) and `mayEnd` (the
 * caller may still send `END` and say "Nothing has changed"). They differ: a stun/kill flag or an unreadable
 * LocalInfo has `frameSent` false and `mayEnd` false. Callers must not test the fields on an unknown error;
 * ask `atD890RangeChangeMayEndAfter(err)`, which is true only for the known-safe refusals and fails closed for
 * everything else, including `AtD890StunKillError`. After the `W` the radio holds a half-built image; `END` is
 * the commit, so it is sent only after a clean ACK and never on a failure path.
 */

import type { BytePipe } from '../../../types.ts';
import { RadioIoError } from '../../../kit/errors.ts';
import { throwIfAborted } from '../../../kit/progress.ts';
import { atD890ExitProgram, atD890ReadMemory } from '../connection.ts';
import { D890_MAP } from '../constants.ts';
import { eraseUnitBaseFor } from '../eraseUnits.ts';
import { gateAtD890Write, recordAtD890AbandonedSession } from '../programSession.ts';
import { assertAtD890NoStunKill } from '../stunKillGuard.ts';
import {
  AT_D890_RANGE_CHANGE_EXTENT,
  AtD890RangeChangeRefusedError,
  buildAtD890RangeChangeFrame,
} from './rangeChangeFrame.ts';
import {
  AtD890RangeChangeSendRefusedError,
  createAtD890RangeChangeSender,
} from './rangeChangeSend.ts';

export type AtD890RangeChangeFailure =
  /** LocalInfo could not be read; the stun/kill state is unknown. */
  | 'read-failed'
  /** LocalInfo no longer matches the backup. Nothing was written. */
  | 'local-info-changed'
  /** The caller's journal write failed. Nothing was written. */
  | 'before-send-failed'
  /** The sender refused the payload before writing. Nothing was written. */
  | 'send-refused'
  /** The `W` was not cleanly ACKed (NAK, timeout, port lost). `END` must not be sent. */
  | 'send-failed'
  /** The `W` was ACKed but `END` failed. */
  | 'end-failed';

export class AtD890RangeChangeSessionError extends RadioIoError {
  readonly failure: AtD890RangeChangeFailure;
  /** A `W` may have reached the radio. False means nothing was written. */
  readonly frameSent: boolean;
  /** The caller may `END` and say "Nothing has changed": nothing written and no flag or unknown state. */
  readonly mayEnd: boolean;

  constructor(
    failure: AtD890RangeChangeFailure,
    state: { frameSent: boolean; mayEnd: boolean },
    message: string,
    cause?: unknown,
  ) {
    super('protocol', message);
    this.name = 'AtD890RangeChangeSessionError';
    this.failure = failure;
    this.frameSent = state.frameSent;
    this.mayEnd = state.mayEnd;
    if (cause !== undefined) this.cause = cause;
  }
}

export interface AtD890RangeChangeOptions {
  /** LocalInfo `0x100` bytes from the verified backup. */
  backupLocalInfo: Uint8Array;
  target: number;
  /** Runs after every check and before the `W`; the caller writes its journal here. A throw aborts, unsent. */
  onBeforeSend: () => void | Promise<void>;
  signal?: AbortSignal;
}

export interface AtD890RangeChangeResult {
  /** The 16 bytes that were sent. */
  frame: Uint8Array;
}

/**
 * May the caller send `END` after this error? True only for errors known to be safe: a frame refusal or a
 * session error that says `mayEnd` with nothing sent. False for everything else, so a stun/kill flag
 * (`AtD890StunKillError`), an unreadable LocalInfo, a failure after the `W`, and any error this module does
 * not know all fail closed.
 */
export function atD890RangeChangeMayEndAfter(err: unknown): boolean {
  if (err instanceof AtD890RangeChangeRefusedError) return !err.frameSent && err.mayEnd;
  if (err instanceof AtD890RangeChangeSessionError) return !err.frameSent && err.mayEnd;
  return false;
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export async function changeAtD890FrequencyRange(
  pipe: BytePipe,
  opts: AtD890RangeChangeOptions,
): Promise<AtD890RangeChangeResult> {
  const { backupLocalInfo, target, onBeforeSend, signal } = opts;

  let live: Uint8Array;
  try {
    live = await atD890ReadMemory(pipe, D890_MAP.LocalInfo, D890_MAP.LocalInfoLength, signal);
  } catch (err) {
    throw new AtD890RangeChangeSessionError(
      'read-failed',
      { frameSent: false, mayEnd: false },
      `Could not read the radio's LocalInfo: ${describe(err)}`,
      err,
    );
  }

  // A flag means END would rewrite LocalInfo from stale RAM: rethrow unchanged, the caller must not END.
  assertAtD890NoStunKill(live);

  // Units left pending by an interrupted Write (#1406): this session's `END` would promote them. The gate throws
  // `AtD890PendingUnitsError` before anything is written, and it is not wrapped: `atD890RangeChangeMayEndAfter`
  // fails closed on it, so the caller leaves PROGRAM without `END`. A range change never rewrites those units.
  gateAtD890Write(pipe, [eraseUnitBaseFor(D890_MAP.LocalInfo)]);

  if (
    !bytesEqual(
      live.subarray(0, D890_MAP.LocalInfoLength),
      backupLocalInfo.subarray(0, D890_MAP.LocalInfoLength),
    )
  ) {
    throw new AtD890RangeChangeSessionError(
      'local-info-changed',
      { frameSent: false, mayEnd: true },
      'The radio’s LocalInfo no longer matches the backup. Nothing has changed.',
    );
  }

  // Refusals carry frameSent and mayEnd themselves: nothing has been sent.
  const frame = buildAtD890RangeChangeFrame(live, target);

  try {
    await onBeforeSend();
    throwIfAborted(signal);
  } catch (err) {
    throw new AtD890RangeChangeSessionError(
      'before-send-failed',
      { frameSent: false, mayEnd: true },
      `Stopped before sending: ${describe(err)}`,
      err,
    );
  }

  try {
    await createAtD890RangeChangeSender(pipe).send(
      AT_D890_RANGE_CHANGE_EXTENT.start,
      frame,
      { liveLocalInfo: live, backupLocalInfo },
      signal,
    );
  } catch (err) {
    const refused = err instanceof AtD890RangeChangeSendRefusedError;
    // The `W` was latched and no `END` follows: settle the in-progress marker (nothing finished to record).
    if (!refused) recordAtD890AbandonedSession(pipe);
    throw new AtD890RangeChangeSessionError(
      refused ? 'send-refused' : 'send-failed',
      refused ? { frameSent: false, mayEnd: true } : { frameSent: true, mayEnd: false },
      `The radio did not confirm the range change: ${describe(err)}`,
      err,
    );
  }

  try {
    await atD890ExitProgram(pipe);
  } catch (err) {
    recordAtD890AbandonedSession(pipe);
    throw new AtD890RangeChangeSessionError(
      'end-failed',
      { frameSent: true, mayEnd: false },
      `The range change was sent but END failed: ${describe(err)}`,
      err,
    );
  }
  return { frame };
}
