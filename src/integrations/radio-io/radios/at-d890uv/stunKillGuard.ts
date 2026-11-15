/**
 * AT-D890UV stun / kill guard — LocalInfo `+0x00` / `+0x01`.
 *
 * A non-zero flag means the radio has been remotely stunned or killed. In a read session, `END` with a flag set
 * clears the flag and erases and rewrites LocalInfo (hardware, #1288). A session that sees a flag must therefore
 * not send `END`. The operator is told to power-cycle the radio instead.
 *
 * One small helper so every D890 session (vital backup now; the write and read sessions in PR 4c) converges on
 * the same check and the same wording.
 */

import { RadioProtocolError } from '../../kit/errors.ts';
import type { BytePipe } from '../../types.ts';
import { atD890ExitProgram, atD890ReadMemory } from './connection.ts';
import { AT_D890_BLOCK_SIZE, D890_MAP } from './constants.ts';

export const AT_D890_STUN_FLAG_OFFSET = 0x00;
export const AT_D890_KILL_FLAG_OFFSET = 0x01;

export const AT_D890_STUN_KILL_MESSAGE =
  'This radio reports a stun or kill flag in its local info. Studio has stopped without sending END, because END ' +
  "would clear the flag and erase and rewrite the radio's LocalInfo. Power-cycle the radio, then try again.";

export interface AtD890StunKillState {
  stun: number;
  kill: number;
  /** True when either flag is non-zero. */
  flagged: boolean;
}

/** Read the two flag bytes from LocalInfo (or any span that starts at LocalInfo). */
export function atD890StunKillState(localInfo: Uint8Array): AtD890StunKillState {
  if (localInfo.length < 2) {
    throw new RadioProtocolError('D890 stun/kill check needs at least 2 LocalInfo bytes');
  }
  const stun = localInfo[AT_D890_STUN_FLAG_OFFSET]!;
  const kill = localInfo[AT_D890_KILL_FLAG_OFFSET]!;
  return { stun, kill, flagged: stun !== 0 || kill !== 0 };
}

/** The session stopped on a stun/kill flag. The caller must not send `END`. */
export class AtD890StunKillError extends RadioProtocolError {
  readonly state: AtD890StunKillState;

  constructor(state: AtD890StunKillState) {
    super(AT_D890_STUN_KILL_MESSAGE);
    this.name = 'AtD890StunKillError';
    this.state = state;
  }
}

/** Throw {@link AtD890StunKillError} when either flag is non-zero. */
export function assertAtD890NoStunKill(localInfo: Uint8Array): void {
  const state = atD890StunKillState(localInfo);
  if (state.flagged) throw new AtD890StunKillError(state);
}

/** End a session only when its successfully read LocalInfo flags are both zero. */
export async function endAtD890WithLocalInfo(
  pipe: BytePipe,
  head: Uint8Array | null,
): Promise<void> {
  if (!head || head.length < 2) {
    throw new RadioProtocolError(
      'Studio could not read the radio’s LocalInfo flags. END was not sent. Power-cycle the radio before continuing.',
    );
  }
  assertAtD890NoStunKill(head);
  await atD890ExitProgram(pipe);
}

/** End a read-only session only after a fresh, successful LocalInfo check. */
export async function endAtD890ReadSession(pipe: BytePipe): Promise<void> {
  // A 16-byte read is the radio minimum. Never read after W: it loses staged data.
  let head: Uint8Array;
  try {
    head = await atD890ReadMemory(pipe, D890_MAP.LocalInfo, AT_D890_BLOCK_SIZE);
  } catch {
    throw new RadioProtocolError(
      'Studio could not read the radio’s LocalInfo flags. END was not sent. Power-cycle the radio before continuing.',
    );
  }
  await endAtD890WithLocalInfo(pipe, head);
}

/** Preserve the original failure while explaining how to leave an abandoned read session. */
export function withAtD890ReadRecovery<Args extends unknown[], Result>(
  read: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  return async (...args) => {
    try {
      return await read(...args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/power-cycle/i.test(message)) throw error;
      const recovery = `${message} The radio may still be in programming mode. Power-cycle the radio before continuing.`;
      if (error instanceof Error) {
        error.message = recovery;
        throw error;
      }
      throw new RadioProtocolError(recovery);
    }
  };
}
