/**
 * AT-D890UV range change: the one 16-byte LocalInfo frame, as pure data.
 *
 * The range is LocalInfo `+0x03`. The firmware takes a change from a single PC-link `W` of 16 bytes at
 * `0x04F80000`: it overlays the frame on the RAM image it pre-loaded from the live LocalInfo, and commits the
 * image at `END`. So the frame carries `+0x00..+0x0F` of the live LocalInfo with only `+0x03` changed. This
 * module builds that frame and refuses to build it when any sibling byte in the block is not in a state the
 * change can safely ride on. See docs/reference/radios/anytone/at-d890uv/band-code.md.
 *
 * Nothing here talks to a radio.
 */

import { isAtD890RangeChangeTarget } from '@core/radios/anytone/at-d890uv/frequencyRange.ts';
import { RadioInterlockError } from '../../../kit/errors.ts';
import { D890_MAP } from '../constants.ts';

/**
 * The only extent a range change writes. Deliberately **not** in `AT_D890_WRITABLE_EXTENTS`: no generic write
 * helper may reach LocalInfo; only `rangeChangeSend.ts` does.
 */
export const AT_D890_RANGE_CHANGE_EXTENT = {
  id: 'RangeCode',
  start: 0x04f80000,
  length: 0x10,
} as const;

export const AT_D890_LOCAL_INFO_RANGE_OFFSET = 0x03;
const STUN_OFFSET = 0x00;
const KILL_OFFSET = 0x01;
const MARKET_OFFSET = 0x04;
const LANGUAGE_LOCK_OFFSET = 0x05;
const MODEL_OFFSET = 0x10;
const UNLOCK_OFFSET = 0x0b;

const MODEL_ASCII = [0x44, 0x38, 0x39, 0x30, 0x55, 0x56]; // "D890UV"
const UNLOCK_ASCII = [0x38, 0x39, 0x30, 0x23]; // "890#"

export type AtD890RangeChangeRefusalReason =
  | 'short-local-info'
  | 'stun-kill-flag'
  | 'market-lock-mismatch'
  | 'model-mismatch'
  | 'target-not-allowed'
  | 'maintenance-locked'
  | 'target-is-current';

/** The frame builder refused. Nothing has been sent. */
export class AtD890RangeChangeRefusedError extends RadioInterlockError {
  readonly reason: AtD890RangeChangeRefusalReason;
  /** Nothing has been sent, so the caller may `END`, unless a stun/kill flag was seen (END would rewrite LocalInfo). */
  get endSafe(): boolean {
    return this.reason !== 'stun-kill-flag';
  }

  constructor(reason: AtD890RangeChangeRefusalReason, message: string) {
    super(message);
    this.name = 'AtD890RangeChangeRefusedError';
    this.reason = reason;
  }
}

function matchesAt(buf: Uint8Array, offset: number, expected: readonly number[]): boolean {
  return expected.every((b, i) => buf[offset + i] === b);
}

/**
 * Build the 16-byte frame for `target`, from the live LocalInfo (`>= 0x100` bytes) just read from the radio.
 * Returns a copy of `+0x00..+0x0F` with only `+0x03` set.
 */
export function buildAtD890RangeChangeFrame(liveLocalInfo: Uint8Array, target: number): Uint8Array {
  if (liveLocalInfo.length < D890_MAP.LocalInfoLength) {
    throw new AtD890RangeChangeRefusedError(
      'short-local-info',
      `LocalInfo read is ${liveLocalInfo.length} bytes, expected ${D890_MAP.LocalInfoLength}.`,
    );
  }
  if (liveLocalInfo[STUN_OFFSET] !== 0 || liveLocalInfo[KILL_OFFSET] !== 0) {
    throw new AtD890RangeChangeRefusedError(
      'stun-kill-flag',
      'The radio reports a stun or kill flag; a range change would be undone by END.',
    );
  }
  if (liveLocalInfo[MARKET_OFFSET] !== liveLocalInfo[LANGUAGE_LOCK_OFFSET]) {
    throw new AtD890RangeChangeRefusedError(
      'market-lock-mismatch',
      'LocalInfo market and language-lock bytes differ; the radio would run factory defaults.',
    );
  }
  if (!matchesAt(liveLocalInfo, MODEL_OFFSET, MODEL_ASCII)) {
    throw new AtD890RangeChangeRefusedError(
      'model-mismatch',
      'LocalInfo does not carry the D890UV model string.',
    );
  }
  if (!Number.isInteger(target) || !isAtD890RangeChangeTarget(target)) {
    throw new AtD890RangeChangeRefusedError(
      'target-not-allowed',
      `Range code ${String(target)} is not an allowed target.`,
    );
  }
  if (target === 14 && !matchesAt(liveLocalInfo, UNLOCK_OFFSET, UNLOCK_ASCII)) {
    throw new AtD890RangeChangeRefusedError(
      'maintenance-locked',
      'Range code 14 needs the 890# unlock in LocalInfo.',
    );
  }
  if (liveLocalInfo[AT_D890_LOCAL_INFO_RANGE_OFFSET] === target) {
    throw new AtD890RangeChangeRefusedError(
      'target-is-current',
      `The radio is already on range code ${target}.`,
    );
  }

  const frame = liveLocalInfo.slice(0, AT_D890_RANGE_CHANGE_EXTENT.length);
  frame[AT_D890_LOCAL_INFO_RANGE_OFFSET] = target;

  // Belt and braces: exactly one byte differs from what the radio holds.
  const diffs: number[] = [];
  for (let i = 0; i < frame.length; i++) if (frame[i] !== liveLocalInfo[i]) diffs.push(i);
  if (diffs.length !== 1 || diffs[0] !== AT_D890_LOCAL_INFO_RANGE_OFFSET) {
    throw new AtD890RangeChangeRefusedError(
      'target-not-allowed',
      `Range change frame differs from LocalInfo at ${diffs.length} bytes, expected 1.`,
    );
  }
  return frame;
}
