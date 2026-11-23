/**
 * Write stages for the DM-32UV RadioFoundry fast codeplug path.
 * Labels match the strings `download` / `upload` emit, in that order.
 */

import type { PlannedStage, RadioOperation, RadioPlanContext } from '../../types.ts';
import { BLOCK_SIZE, servedBlockAddresses } from './constants.ts';
import { RADIOFOUNDRY_IMAGE_SIZE } from '@core/import-export/formats/radiofoundry/layout.ts';

const READ_BYTES = servedBlockAddresses(RADIOFOUNDRY_IMAGE_SIZE).length * BLOCK_SIZE;
/** Sized before the read. A real write sends only the blocks that differ. */
const NOMINAL_CHANGED_BLOCKS = 8;

export function planRadioFoundryStages(op: RadioOperation, ctx: RadioPlanContext): PlannedStage[] {
  void ctx;
  if (op !== 'write') return [];
  return [
    { label: 'Pre-write read', weight: READ_BYTES },
    { label: 'Codeplug blocks', weight: NOMINAL_CHANGED_BLOCKS * BLOCK_SIZE },
    { label: 'Commit', weight: 32 },
  ];
}
