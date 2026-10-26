/**
 * AT-D890UV stun / kill guard — LocalInfo `+0x00` / `+0x01`.
 *
 * A non-zero flag means the radio has been remotely stunned or killed. In a read session, `END` with a flag set
 * clears the flag and erases and rewrites LocalInfo (hardware, #1288). A session that sees a flag must therefore not send `END`. The operator is told to
 * power-cycle the radio instead.
 *
 * One small helper so every D890 session (vital backup now; the write and read sessions in PR 4c) converges on
 * the same check and the same wording.
 */

import { RadioProtocolError } from '../../kit/errors.ts';

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
