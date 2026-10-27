/**
 * AT-D890UV range change: the only code in Studio that can write LocalInfo.
 *
 * One frame, one address: a PC-link `W` of 16 bytes at `0x04F80000`. The sender is one-shot (a second call
 * throws), never sends `H`, never touches sector markers, never addresses `0x04FC0000` or anything else, and
 * refuses before the first `pipe.write` when the address or length is wrong. A lost ACK is retried by resending
 * the identical frame (the firmware's RAM overlay is idempotent); a NAK or a third timeout throws.
 *
 * The sender validates its own payload and does not trust its caller. Besides address and length it refuses a
 * payload with a stun/kill byte set, `+0x04 != +0x05`, a code above 18, code 14 without `890#` at `+0x0B..+0x0E`,
 * or any difference from the live LocalInfo `+0x00..+0x0F` other than a changed `+0x03`. It therefore requires the
 * live LocalInfo block (and the backed-up one) and refuses when the model or serial region differs between them.
 *
 * Program-session latch (#1406): the `W` is recorded through `noteAtD890WriteFrame`. The `R` frames (LocalInfo, tune
 * bank) and `END` are sent by `rangeChangeSession.ts` through `connection.ts`, which already guard and clear the
 * latch, so this file sends no `R` and no `END` of its own.
 *
 * Import boundary: only files under `rangeChange/` may import this module (rangeChangeBoundary.test.ts).
 */

import type { BytePipe } from '../../../types.ts';
import { ANYTONE_DMR_ACK, makeAnytoneDmrWriteFrame } from '../../../kit/codecs/anytoneDmrRw.ts';
import { RadioInterlockError, RadioProtocolError, RadioTimeoutError } from '../../../kit/errors.ts';
import { throwIfAborted } from '../../../kit/progress.ts';
import { AT_D890_CONNECTION } from '../constants.ts';
import { isAtD890RangeChangeTarget } from '@core/radios/anytone/at-d890uv/frequencyRange.ts';
import { D890_MAP } from '../constants.ts';
import { LOCAL_INFO_SERIAL_LENGTH, LOCAL_INFO_SERIAL_OFFSET } from '../identityCheck.ts';
import { noteAtD890WriteFrame } from '../programSession.ts';
import {
  AT_D890_LOCAL_INFO_RANGE_OFFSET,
  AT_D890_RANGE_CHANGE_EXTENT,
} from './rangeChangeFrame.ts';

const MODEL_OFFSET = 0x10;
const MODEL_LENGTH = 6; // "D890UV"
const UNLOCK_OFFSET = 0x0b;
const UNLOCK_ASCII = [0x38, 0x39, 0x30, 0x23]; // "890#"
const MODEL_ASCII = [0x44, 0x38, 0x39, 0x30, 0x55, 0x56]; // "D890UV"
const MAX_CODE = 18;

/** The original send plus at most two resends of the same frame. */
const RESEND_LIMIT = 2;

/** The LocalInfo the sender checks the payload against. Both are `0x100` bytes. */
export interface AtD890RangeChangeSendContext {
  /** LocalInfo just read from the radio in this session. */
  liveLocalInfo: Uint8Array;
  /** LocalInfo from the verified backup. */
  backupLocalInfo: Uint8Array;
}

export interface AtD890RangeChangeSender {
  /** Send the one frame. Resolves after a clean ACK; throws (before any write) when the payload is not safe. */
  send(
    address: number,
    data16: Uint8Array,
    context: AtD890RangeChangeSendContext,
    signal?: AbortSignal,
  ): Promise<void>;
}

/** The sender refused before writing anything. */
export class AtD890RangeChangeSendRefusedError extends RadioInterlockError {
  readonly frameSent = false;
  constructor(message: string) {
    super(message);
    this.name = 'AtD890RangeChangeSendRefusedError';
  }
}

function refuse(message: string): never {
  throw new AtD890RangeChangeSendRefusedError(message);
}

function regionEqual(a: Uint8Array, b: Uint8Array, offset: number, length: number): boolean {
  for (let i = offset; i < offset + length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Every refusal the sender owns. Throws before anything is written. */
function validatePayload(data16: Uint8Array, context: AtD890RangeChangeSendContext): void {
  const { liveLocalInfo: live, backupLocalInfo: backup } = context ?? ({} as never);
  if (
    !live ||
    !backup ||
    live.length < D890_MAP.LocalInfoLength ||
    backup.length < D890_MAP.LocalInfoLength
  ) {
    refuse('Range change needs the live and backed-up LocalInfo (0x100 bytes each).');
  }
  if (data16[0] !== 0 || data16[1] !== 0) {
    refuse('Range change payload has a stun or kill byte set.');
  }
  if (data16[4] !== data16[5]) {
    refuse('Range change payload has market and language-lock bytes that differ.');
  }
  const code = data16[AT_D890_LOCAL_INFO_RANGE_OFFSET]!;
  if (code > MAX_CODE || !isAtD890RangeChangeTarget(code)) {
    refuse(`Range change payload carries code ${code}, which is not an allowed target.`);
  }
  if (code === 14 && !UNLOCK_ASCII.every((b, i) => data16[UNLOCK_OFFSET + i] === b)) {
    refuse('Range code 14 needs 890# at +0x0B in the payload.');
  }
  if (!MODEL_ASCII.every((b, i) => live[MODEL_OFFSET + i] === b)) {
    refuse('Live LocalInfo does not carry the D890UV model string.');
  }
  if (
    !regionEqual(live, backup, MODEL_OFFSET, MODEL_LENGTH) ||
    !regionEqual(live, backup, LOCAL_INFO_SERIAL_OFFSET, LOCAL_INFO_SERIAL_LENGTH)
  ) {
    refuse(
      'Live LocalInfo model or serial differs from the backup; this is not the backed-up radio.',
    );
  }
  for (let i = 0; i < AT_D890_RANGE_CHANGE_EXTENT.length; i++) {
    const expected = i === AT_D890_LOCAL_INFO_RANGE_OFFSET ? code : live[i];
    if (data16[i] !== expected) {
      refuse(`Range change payload differs from the live LocalInfo at +0x${i.toString(16)}.`);
    }
  }
  if (live[AT_D890_LOCAL_INFO_RANGE_OFFSET] === code) {
    refuse('Range change payload does not change the range code.');
  }
}

export function createAtD890RangeChangeSender(pipe: BytePipe): AtD890RangeChangeSender {
  let used = false;
  return {
    async send(address, data16, context, signal) {
      if (used) {
        throw new AtD890RangeChangeSendRefusedError(
          'The range-change sender sends one frame, once.',
        );
      }
      if (address !== AT_D890_RANGE_CHANGE_EXTENT.start) {
        throw new AtD890RangeChangeSendRefusedError(
          `Range change may only write 0x${AT_D890_RANGE_CHANGE_EXTENT.start.toString(16)}, not 0x${(address >>> 0).toString(16)}.`,
        );
      }
      if (data16.length !== AT_D890_RANGE_CHANGE_EXTENT.length) {
        throw new AtD890RangeChangeSendRefusedError(
          `Range change frame must be ${AT_D890_RANGE_CHANGE_EXTENT.length} bytes, got ${data16.length}.`,
        );
      }
      validatePayload(data16, context);
      throwIfAborted(signal);
      used = true;

      const frame = makeAnytoneDmrWriteFrame(
        AT_D890_RANGE_CHANGE_EXTENT.start,
        AT_D890_RANGE_CHANGE_EXTENT.length,
        data16,
      );
      for (let attempt = 0; ; attempt++) {
        throwIfAborted(signal);
        // Program-session latch (#1406): set before the frame leaves, resends included, so no `R` follows this
        // `W` until `END`. It also refuses (nothing sent) while units from an interrupted Write are pending.
        noteAtD890WriteFrame(pipe, AT_D890_RANGE_CHANGE_EXTENT.start);
        await pipe.write(frame);
        try {
          const ack = await pipe.readExact(1, AT_D890_CONNECTION.TIMEOUT.WRITE_MS);
          if (ack[0] !== ANYTONE_DMR_ACK) {
            throw new RadioProtocolError(
              `D890 range change not ACKed: got 0x${ack[0]?.toString(16) ?? '??'}`,
            );
          }
          return;
        } catch (err) {
          if (!(err instanceof RadioTimeoutError) || attempt >= RESEND_LIMIT) throw err;
          await pipe.flush?.();
        }
      }
    },
  };
}
