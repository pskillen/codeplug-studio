/**
 * AT-D890UV range change: the only code in Studio that can write LocalInfo.
 *
 * One frame, one address: a PC-link `W` of 16 bytes at `0x04F80000`. The sender is one-shot (a second call
 * throws), never sends `H`, never touches sector markers, never addresses `0x04FC0000` or anything else, and
 * refuses before the first `pipe.write` when the address or length is wrong. A lost ACK is retried by resending
 * the identical frame (the firmware's RAM overlay is idempotent); a NAK or a third timeout throws.
 *
 * Import boundary: only files under `rangeChange/` may import this module (rangeChangeBoundary.test.ts).
 */

import type { BytePipe } from '../../../types.ts';
import { ANYTONE_DMR_ACK, makeAnytoneDmrWriteFrame } from '../../../kit/codecs/anytoneDmrRw.ts';
import { RadioInterlockError, RadioProtocolError, RadioTimeoutError } from '../../../kit/errors.ts';
import { throwIfAborted } from '../../../kit/progress.ts';
import { AT_D890_CONNECTION } from '../constants.ts';
import { AT_D890_RANGE_CHANGE_EXTENT } from './rangeChangeFrame.ts';

/** The original send plus at most two resends of the same frame. */
const RESEND_LIMIT = 2;

export interface AtD890RangeChangeSender {
  /** Send the one frame. Resolves after a clean ACK; throws otherwise. */
  send(address: number, data16: Uint8Array, signal?: AbortSignal): Promise<void>;
}

export function createAtD890RangeChangeSender(pipe: BytePipe): AtD890RangeChangeSender {
  let used = false;
  return {
    async send(address, data16, signal) {
      if (used) {
        throw new RadioInterlockError('The range-change sender sends one frame, once.');
      }
      if (address !== AT_D890_RANGE_CHANGE_EXTENT.start) {
        throw new RadioInterlockError(
          `Range change may only write 0x${AT_D890_RANGE_CHANGE_EXTENT.start.toString(16)}, not 0x${(address >>> 0).toString(16)}.`,
        );
      }
      if (data16.length !== AT_D890_RANGE_CHANGE_EXTENT.length) {
        throw new RadioInterlockError(
          `Range change frame must be ${AT_D890_RANGE_CHANGE_EXTENT.length} bytes, got ${data16.length}.`,
        );
      }
      throwIfAborted(signal);
      used = true;

      const frame = makeAnytoneDmrWriteFrame(
        AT_D890_RANGE_CHANGE_EXTENT.start,
        AT_D890_RANGE_CHANGE_EXTENT.length,
        data16,
      );
      for (let attempt = 0; ; attempt++) {
        throwIfAborted(signal);
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
