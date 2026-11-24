/**
 * Write stages for the DM-32UV RadioFoundry fast codeplug path.
 * Labels match the strings `download` / `upload` emit, in that order.
 */

import type { PlannedStage, RadioOperation, RadioPlanContext } from '../../types.ts';
import { BLOCK_SIZE, servedBlockAddresses } from './constants.ts';
import { RADIOFOUNDRY_IMAGE_SIZE } from '@core/import-export/formats/radiofoundry/layout.ts';
import { BLOCK_CHECKSUMS_STAGE, isRadioFoundryCableRadio, PRE_WRITE_STAGE } from './protocol.ts';

const READ_BYTES = servedBlockAddresses(RADIOFOUNDRY_IMAGE_SIZE).length * BLOCK_SIZE;
/** Sized before the read. A real write sends only the blocks that differ. */
const NOMINAL_CHANGED_BLOCKS = 8;
/** SUMS takes about 16/86 of a READ's time per block; weights use bytes as a time proxy. */
const CHECKSUM_BYTES_PER_BLOCK = 760;

export function planRadioFoundryStages(op: RadioOperation, ctx: RadioPlanContext): PlannedStage[] {
  if (op !== 'write') return [];
  const radio = ctx.session?.radio;
  const counts =
    radio && isRadioFoundryCableRadio(radio) ? radio.plannedBlockCounts() : null;
  if (!counts) {
    const servedBlocks = READ_BYTES / BLOCK_SIZE;
    return [
      { label: BLOCK_CHECKSUMS_STAGE, weight: servedBlocks * CHECKSUM_BYTES_PER_BLOCK },
      { label: PRE_WRITE_STAGE, weight: READ_BYTES },
      { label: 'Codeplug blocks', weight: NOMINAL_CHANGED_BLOCKS * BLOCK_SIZE },
      { label: 'Commit', weight: 32 },
    ];
  }
  return [
    { label: BLOCK_CHECKSUMS_STAGE, weight: counts.checksum * CHECKSUM_BYTES_PER_BLOCK },
    { label: PRE_WRITE_STAGE, weight: counts.read * BLOCK_SIZE },
    { label: 'Codeplug blocks', weight: counts.write * BLOCK_SIZE },
    { label: 'Commit', weight: 32 },
  ];
}