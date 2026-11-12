/**
 * UV-5R Mini planned stages: the UV-17Pro family plan, plus 'Zone table' when the Write projection is for the
 * MM9PDY target. Labels equal the `stage` strings the protocol emits.
 */

import type { PlannedStage, RadioOperation, RadioPlanContext } from '../../types.ts';
import { UV5R_MINI_LAYOUT } from '../uv17pro-family/layout.ts';
import { createUv17ProPlanStages } from '../uv17pro-family/plannedStages.ts';
import { encodeUv5rMiniZoneTable } from './modData/index.ts';
import { uv5rMiniZoneIntentFromOrganisation } from './modDataIntent.ts';
import { UV5R_MINI_ZONE_TABLE_STAGE } from './protocol.ts';

const familyStages = createUv17ProPlanStages(UV5R_MINI_LAYOUT);

export function planUv5rMiniStages(op: RadioOperation, ctx: RadioPlanContext): PlannedStage[] {
  const stages = familyStages(op, ctx);
  if (op !== 'write') return stages;
  const intent = uv5rMiniZoneIntentFromOrganisation(ctx.prepared?.organisation);
  if (!intent) return stages;
  const frames = encodeUv5rMiniZoneTable(intent).frames.length;
  return [
    ...stages,
    { label: UV5R_MINI_ZONE_TABLE_STAGE, weight: frames * UV5R_MINI_LAYOUT.blockSize },
  ];
}
