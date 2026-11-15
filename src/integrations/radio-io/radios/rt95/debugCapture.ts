import { throwIfAborted } from '../../kit/progress.ts';
import { evaluateRt95ChipGuard } from './modData/chipGuard.ts';
import {
  MMD1_BASE,
  MMD1_END,
  RT95_GUARD_IDENT_ADDR,
  RT95_GUARD_ALIAS_ADDR,
} from './modData/layout.ts';
import {
  RT95_CALIBRATION_LENGTH,
  RT95_CALIBRATION_START,
} from '@core/radios/retevis/rt95/calibration.ts';
import type { Rt95Protocol } from './protocol.ts';

export const RT95_CALIBRATION_REGION_ID = 'rt95-calibration';
export const RT95_CALIBRATION_REGION_PATH = 'regions/rt95-calibration.bin';

/** Read only the fixed debug prefix through the existing protocol and guard. */
export async function readRt95Calibration(
  radio: Pick<Rt95Protocol, 'readBlocks'>,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const addresses = Array.from(
    { length: RT95_CALIBRATION_LENGTH / 16 },
    (_, i) => RT95_CALIBRATION_START + i * 16,
  );
  const blocks = await radio.readBlocks(addresses, { signal });
  throwIfAborted(signal);
  const bytes = new Uint8Array(RT95_CALIBRATION_LENGTH);
  for (const address of addresses) {
    const block = blocks.get(address);
    if (!block || block.length !== 16) throw new Error('Invalid RT95 calibration block.');
    bytes.set(block, address - RT95_CALIBRATION_START);
  }
  return bytes;
}

export const RT95_MMD1_REGION_ID = 'rt95-mmd1';
export const RT95_MMD1_REGION_PATH = 'regions/rt95-mmd1.bin';
export const RT95_GUARD_IDENT_SIDECAR = 'debug/rt95-guard-ident.bin';
export const RT95_GUARD_ALIAS_SIDECAR = 'debug/rt95-guard-alias.bin';
export const RT95_GUARD_OUTCOME_SIDECAR = 'debug/rt95-guard.json';

/** Read both guard blocks before any MMD1 address; transport errors propagate. */
export async function readRt95Mmd1(radio: Pick<Rt95Protocol, 'readBlocks'>, signal?: AbortSignal) {
  const probes = await radio.readBlocks([RT95_GUARD_IDENT_ADDR, RT95_GUARD_ALIAS_ADDR], { signal });
  throwIfAborted(signal);
  const ident = probes.get(RT95_GUARD_IDENT_ADDR);
  const alias = probes.get(RT95_GUARD_ALIAS_ADDR);
  if (ident?.length !== 16 || alias?.length !== 16) throw new Error('Invalid RT95 guard block.');
  const outcome = evaluateRt95ChipGuard(ident, alias);
  if (!outcome.ok) return { ident, alias, outcome, bytes: undefined };
  const addresses = Array.from(
    { length: (MMD1_END - MMD1_BASE) / 16 },
    (_, i) => MMD1_BASE + i * 16,
  );
  const blocks = await radio.readBlocks(addresses, { signal });
  throwIfAborted(signal);
  const bytes = new Uint8Array(MMD1_END - MMD1_BASE);
  for (const address of addresses) {
    const block = blocks.get(address);
    if (!block || block.length !== 16) throw new Error('Invalid RT95 MMD1 block.');
    bytes.set(block, address - MMD1_BASE);
  }
  return { ident, alias, outcome, bytes };
}
