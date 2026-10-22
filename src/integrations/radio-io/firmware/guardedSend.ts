import type { BytePipe } from '../types.ts';

/**
 * The ONLY `pipe.write` call site in firmware code. `check` runs on every frame before it is written and throws
 * RadioInterlockError to refuse; a refusal means nothing is written and the error propagates.
 */
export function createGuardedSend(
  pipe: BytePipe,
  check: (frame: Uint8Array) => void,
): (frame: Uint8Array) => Promise<void> {
  return async (frame: Uint8Array) => {
    check(frame);
    await pipe.write(frame);
  };
}
