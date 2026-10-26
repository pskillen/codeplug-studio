/**
 * RT95 planned stages (#1393). Labels equal the `stage` strings the Write emits: the session's
 * pre-write read ('Pre-write read', `radioIoSession.ts`) and `Rt95Protocol.upload()` ('Upload').
 * Weights are bytes on the wire: the whole image each way.
 */

import type { PlannedStage, RadioOperation, RadioPlanContext } from '../../types.ts';
import { RT95_BLOCK_COUNT, RT95_BLOCK_SIZE } from './constants.ts';

const IMAGE_BYTES = RT95_BLOCK_COUNT * RT95_BLOCK_SIZE;

export function planRt95Stages(op: RadioOperation, ctx: RadioPlanContext): PlannedStage[] {
  void ctx;
  if (op === 'write') {
    return [
      { label: 'Pre-write read', weight: IMAGE_BYTES },
      { label: 'Upload', weight: IMAGE_BYTES },
    ];
  }
  return [];
}
