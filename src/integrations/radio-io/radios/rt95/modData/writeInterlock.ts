import { RadioProtocolError } from '../../../kit/errors.ts';
import { RT95_BLOCK_ADDR_END, RT95_BLOCK_SIZE } from '../constants.ts';
import { MMD1_BASE, MMD1_END, MMD1_STATE_ADDR, RT95_NEVER_WRITE_FROM } from './layout.ts';

export type Rt95WriteProfile = 'stock' | 'mm9pdy';

export interface Rt95WriteContext {
  profile: Rt95WriteProfile;
  chipGuardPassed: boolean;
  operation: 'write' | 'restore';
}

export class Rt95WriteRefusedError extends RadioProtocolError {
  readonly address: number;
  constructor(address: number, rule: string) {
    super(`RT95 write refused at ${hex(address)}: ${rule}`);
    this.name = 'Rt95WriteRefusedError';
    this.address = address;
  }
}

function hex(n: number): string {
  return n < 0 ? `-0x${(-n).toString(16)}` : `0x${n.toString(16).toUpperCase().padStart(4, '0')}`;
}

/**
 * Throws `Rt95WriteRefusedError` unless this 16-byte block may be written. Pure. No flag disables it.
 *
 * Allowed: 16-aligned 16-byte blocks in 0x0000-0x3290 (any profile); on the `mm9pdy` profile with a passing
 * chip guard also 0x4000-0x5FF0, except 0x4010 (the radio's state block) unless `operation` is `restore`.
 */
export function assertRt95WriteAllowed(
  address: number,
  length: number,
  ctx: Rt95WriteContext,
): void {
  if (length !== RT95_BLOCK_SIZE) {
    throw new Rt95WriteRefusedError(address, `length ${length} is not ${RT95_BLOCK_SIZE}`);
  }
  if (!Number.isInteger(address) || address < 0) {
    throw new Rt95WriteRefusedError(address, 'address must be a non-negative integer');
  }
  if (address % RT95_BLOCK_SIZE !== 0) {
    throw new Rt95WriteRefusedError(address, 'address is not 16-byte aligned');
  }
  if (address >= RT95_NEVER_WRITE_FROM) {
    throw new Rt95WriteRefusedError(
      address,
      `never write at or above ${hex(RT95_NEVER_WRITE_FROM)} (aliases the ident and calibration on a 16 KiB chip)`,
    );
  }
  if (address >= MMD1_END) {
    throw new Rt95WriteRefusedError(address, `at or above the ${hex(MMD1_END)} write ceiling`);
  }
  if (address <= RT95_BLOCK_ADDR_END) return;
  if (address < MMD1_BASE) {
    throw new Rt95WriteRefusedError(
      address,
      `between the stock image end (${hex(RT95_BLOCK_ADDR_END)}) and the MMD1 range; ident and calibration live here`,
    );
  }
  if (ctx.profile !== 'mm9pdy') {
    throw new Rt95WriteRefusedError(address, 'MMD1 range is written by the MM9PDY target only');
  }
  if (!ctx.chipGuardPassed) {
    throw new Rt95WriteRefusedError(address, 'chip-size guard has not passed');
  }
  if (address === MMD1_STATE_ADDR && ctx.operation !== 'restore') {
    throw new Rt95WriteRefusedError(
      address,
      'the state block is written by the radio only (Restore excepted)',
    );
  }
}
