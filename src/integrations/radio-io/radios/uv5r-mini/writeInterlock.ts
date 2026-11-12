import { RadioProtocolError } from '../../kit/errors.ts';

export type Uv5rMiniWriteProfile = 'stock' | 'mm9pdy';

export interface Uv5rMiniWriteContext {
  profile: Uv5rMiniWriteProfile;
  operation: 'write' | 'restore';
}

export class Uv5rMiniWriteRefusedError extends RadioProtocolError {
  readonly address: number;
  constructor(address: number, rule: string) {
    super(`UV-5R Mini write refused at ${hex(address)}: ${rule}`);
    this.name = 'Uv5rMiniWriteRefusedError';
    this.address = address;
  }
}

const BLOCK = 0x40;

/** Inclusive start, exclusive end of each span a Write or Restore may program. */
export const UV5R_MINI_WRITE_ALLOWED_SPANS: readonly (readonly [number, number])[] = [
  [0x0000, 0x8040],
  [0x9000, 0x9040],
  [0xa000, 0xa1c0],
];

/** The MM9PDY zone table sector (MMZ1), allowed on the `mm9pdy` profile only. */
export const UV5R_MINI_MM9PDY_WRITE_SPAN: readonly [number, number] = [0xc000, 0xd000];

/** Spans refused whatever the profile, with the reason shown in the error. */
const ALWAYS_REFUSED: readonly { from: number; to: number; rule: string }[] = [
  { from: 0xe000, to: Infinity, rule: 'at or above 0xE000 (calibration and reserved flash)' },
  { from: 0xb000, to: 0xc000, rule: 'firmware log sector 0xB000-0xBFFF' },
  { from: 0xd000, to: 0xe000, rule: 'firmware log sector 0xD000-0xDFFF' },
  { from: 0x8040, to: 0x9000, rule: 'gap 0x8040-0x8FFF is not part of the clone' },
  { from: 0x9040, to: 0xa000, rule: 'gap 0x9040-0x9FFF is not part of the clone' },
];

function hex(n: number): string {
  return n < 0 ? `-0x${(-n).toString(16)}` : `0x${n.toString(16).toUpperCase().padStart(4, '0')}`;
}

/**
 * Throws `Uv5rMiniWriteRefusedError` unless this 64-byte block may be written. Pure. No flag disables it.
 *
 * Allowed: 64-aligned 64-byte blocks inside 0x0000-0x803F, 0x9000-0x903F or 0xA000-0xA1BF. The `mm9pdy`
 * profile also allows 0xC000-0xCFFF (the zone table). The refused ranges apply to both profiles.
 */
export function assertUv5rMiniWriteAllowed(
  address: number,
  length: number,
  ctx: Uv5rMiniWriteContext,
): void {
  if (length !== BLOCK) {
    throw new Uv5rMiniWriteRefusedError(address, `length ${length} is not ${BLOCK}`);
  }
  if (!Number.isInteger(address) || address < 0) {
    throw new Uv5rMiniWriteRefusedError(address, 'address must be a non-negative integer');
  }
  if (address % BLOCK !== 0) {
    throw new Uv5rMiniWriteRefusedError(address, 'address is not 64-byte aligned');
  }
  for (const r of ALWAYS_REFUSED) {
    if (address >= r.from && address < r.to) {
      throw new Uv5rMiniWriteRefusedError(address, r.rule);
    }
  }
  const spans =
    ctx.profile === 'mm9pdy'
      ? [...UV5R_MINI_WRITE_ALLOWED_SPANS, UV5R_MINI_MM9PDY_WRITE_SPAN]
      : UV5R_MINI_WRITE_ALLOWED_SPANS;
  if (!spans.some(([s, e]) => address >= s && address + BLOCK <= e)) {
    throw new Uv5rMiniWriteRefusedError(address, 'outside the write set');
  }
}
