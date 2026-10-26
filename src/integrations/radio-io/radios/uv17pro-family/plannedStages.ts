/**
 * UV-17Pro family planned stages (#1393), shared by the UV-5R Mini and UV-21Pro V2. Labels equal
 * the `stage` strings the Write emits: 'Pre-write read' (the session's read before encode) and
 * 'Upload' (`Uv17ProProtocol.upload()`). Weights are bytes on the wire: the clone image each way.
 */

import type { PlannedStage, RadioOperation, RadioPlanContext } from '../../types.ts';
import type { Uv17ProLayout } from './layout.ts';

export function createUv17ProPlanStages(
  layout: Uv17ProLayout,
): (op: RadioOperation, ctx: RadioPlanContext) => PlannedStage[] {
  const imageBytes = layout.cloneBlockCount * layout.blockSize;
  return (op) =>
    op === 'write'
      ? [
          { label: 'Pre-write read', weight: imageBytes },
          { label: 'Upload', weight: imageBytes },
        ]
      : [];
}
