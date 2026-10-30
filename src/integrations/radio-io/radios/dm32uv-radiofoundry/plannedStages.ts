/**
 * Write stages for the DM-32UV RadioFoundry fast codeplug path.
 * Labels match the strings `download` / `upload` emit, in that order.
 */

import type { PlannedStage, RadioOperation } from '../../types.ts';
import { BLOCK_SIZE, DM32_RADIOFOUNDRY_IMAGE_SIZE, servedBlockAddresses } from './constants.ts';

const READ_BYTES = servedBlockAddresses(DM32_RADIOFOUNDRY_IMAGE_SIZE).length * BLOCK_SIZE;
/** Sized before the read. A real write sends only the blocks that differ. */
const NOMINAL_CHANGED_BLOCKS = 8;

export function planDm32RadioFoundryStages(op: RadioOperation): PlannedStage[] {
  if (op !== 'write') return [];
  return [
    { label: 'Pre-write read', weight: READ_BYTES },
    { label: 'Codeplug blocks', weight: NOMINAL_CHANGED_BLOCKS * BLOCK_SIZE },
    { label: 'Commit', weight: 32 },
  ];
}
