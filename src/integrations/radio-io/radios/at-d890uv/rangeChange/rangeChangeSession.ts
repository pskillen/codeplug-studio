/**
 * AT-D890UV range change session.
 *
 * Called with the radio already in PROGRAM (the wizard's session A). Reads LocalInfo, checks it is still the
 * backed-up one and has no stun/kill flag, builds the frame, lets the caller write its journal, sends the one
 * `W`, and only then sends `END` (which makes the firmware commit and reboot).
 *
 * `endSafe` on every thrown error tells the caller whether it may still send `END`: true only when nothing has
 * been written and no stun/kill flag is known. After the `W` the radio holds a half-built image; `END` is the
 * commit, so it is sent only after a clean ACK and never on a failure path.
 */

import type { BytePipe } from '../../../types.ts';
import { RadioIoError } from '../../../kit/errors.ts';
import { throwIfAborted } from '../../../kit/progress.ts';
import { atD890ExitProgram, atD890ReadMemory } from '../connection.ts';
import { D890_MAP } from '../constants.ts';
import { assertAtD890NoStunKill } from '../stunKillGuard.ts';
import { AT_D890_RANGE_CHANGE_EXTENT, buildAtD890RangeChangeFrame } from './rangeChangeFrame.ts';
import { createAtD890RangeChangeSender } from './rangeChangeSend.ts';

export type AtD890RangeChangeFailure =
  /** LocalInfo could not be read; the stun/kill state is unknown. */
  | 'read-failed'
  /** LocalInfo no longer matches the backup. Nothing was written. */
  | 'local-info-changed'
  /** The caller's journal write failed. Nothing was written. */
  | 'before-send-failed'
  /** The `W` was not cleanly ACKed (NAK, timeout, port lost). `END` must not be sent. */
  | 'send-failed'
  /** The `W` was ACKed but `END` failed. */
  | 'end-failed';

export class AtD890RangeChangeSessionError extends RadioIoError {
  readonly failure: AtD890RangeChangeFailure;
  /** True: nothing written, no flag, the caller may `END` and say "Nothing has changed". */
  readonly endSafe: boolean;

  constructor(
    failure: AtD890RangeChangeFailure,
    endSafe: boolean,
    message: string,
    cause?: unknown,
  ) {
    super('protocol', message);
    this.name = 'AtD890RangeChangeSessionError';
    this.failure = failure;
    this.endSafe = endSafe;
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
      false,
      `Could not read the radio's LocalInfo: ${describe(err)}`,
      err,
    );
  }

  // A flag means END would rewrite LocalInfo from stale RAM: rethrow unchanged, the caller must not END.
  assertAtD890NoStunKill(live);

  if (
    !bytesEqual(
      live.subarray(0, D890_MAP.LocalInfoLength),
      backupLocalInfo.subarray(0, D890_MAP.LocalInfoLength),
    )
  ) {
    throw new AtD890RangeChangeSessionError(
      'local-info-changed',
      true,
      'The radio’s LocalInfo no longer matches the backup. Nothing has changed.',
    );
  }

  // Refusals carry endSafe = true themselves: nothing has been sent.
  const frame = buildAtD890RangeChangeFrame(live, target);

  try {
    await onBeforeSend();
    throwIfAborted(signal);
  } catch (err) {
    throw new AtD890RangeChangeSessionError(
      'before-send-failed',
      true,
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
    throw new AtD890RangeChangeSessionError(
      'send-failed',
      false,
      `The radio did not confirm the range change: ${describe(err)}`,
      err,
    );
  }

  try {
    await atD890ExitProgram(pipe);
  } catch (err) {
    throw new AtD890RangeChangeSessionError(
      'end-failed',
      false,
      `The range change was sent but END failed: ${describe(err)}`,
      err,
    );
  }
  return { frame };
}
