import { beforeEach } from 'vitest';

/**
 * Opt-out for the leaked-marker check in `setup.ts`: a test that intentionally ends with an AT-D890
 * pending-units record in storage (an abandoned Write, say) calls this once. It covers that test only.
 */
let allowed = false;

export function allowLeakedD890Marker(): void {
  allowed = true;
}

/** Read and reset the flag (used by `setup.ts` after each test). */
export function consumeLeakedD890MarkerAllowance(): boolean {
  const was = allowed;
  allowed = false;
  return was;
}

/**
 * Call at the top of a test file whose tests drive Writes over a fake pipe and do not always
 * finish them with `END` (the in-progress marker is then left on purpose, or is beside the point).
 */
export function allowLeakedD890MarkersInThisFile(): void {
  beforeEach(allowLeakedD890Marker);
}
