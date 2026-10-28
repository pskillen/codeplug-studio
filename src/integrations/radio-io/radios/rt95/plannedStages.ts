/**
 * RT95 planned stages (#1393). Labels equal the `stage` strings the Write emits: the session's
 * pre-write read ('Pre-write read', `radioIoSession.ts`) and `Rt95Protocol.upload()` ('Upload').
 * Weights are bytes on the wire: the whole image each way. The MM9PDY target adds the chip-guard
 * reads to the first stage and its MMD1 blocks to the second.
 */

import type { PlannedStage, RadioOperation, RadioPlanContext } from '../../types.ts';
import { RT95_BLOCK_COUNT, RT95_BLOCK_SIZE } from './constants.ts';
import { rt95ModDataBlockCount, rt95ModDataIntentFromOrganisation } from './modDataIntent.ts';

const IMAGE_BYTES = RT95_BLOCK_COUNT * RT95_BLOCK_SIZE;
/** Chip guard: the ident block at 0x3B00 and the block at 0x7B00. */
const GUARD_BYTES = 2 * RT95_BLOCK_SIZE;

export function planRt95Stages(op: RadioOperation, ctx: RadioPlanContext): PlannedStage[] {
  if (op === 'write') {
    const intent = rt95ModDataIntentFromOrganisation(
      ctx.prepared?.organisation,
      ctx.prepared?.channels,
    );
    return [
      { label: 'Pre-write read', weight: IMAGE_BYTES + (intent ? GUARD_BYTES : 0) },
      {
        label: 'Upload',
        weight: IMAGE_BYTES + (intent ? RT95_BLOCK_SIZE * rt95ModDataBlockCount(intent) : 0),
      },
    ];
  }
  return [];
}
