/**
 * RT95 planned stages (#1393, #1476). Labels match `ProgressUpdate.stage` strings the protocol
 * emits. Settings-only Write plans touched-block read+write weights, not a full 0x32A0 upload.
 */

import type { PlannedStage, RadioOperation, RadioPlanContext } from '../../types.ts';
import { RT95_BLOCK_COUNT, RT95_BLOCK_SIZE } from './constants.ts';
import { rt95ModDataBlockCount, rt95ModDataIntentFromOrganisation } from './modDataIntent.ts';
import { resolveRt95SettingsPatches } from './settingsFields.ts';
import { touchedRt95Blocks } from './settingsPatch.ts';

const IMAGE_BYTES = RT95_BLOCK_COUNT * RT95_BLOCK_SIZE;
/** Chip guard: the ident block at 0x3B00 and the block at 0x7B00. */
const GUARD_BYTES = 2 * RT95_BLOCK_SIZE;

function isSettingsOnly(ctx: RadioPlanContext): boolean {
  const p = ctx.parts;
  return p !== undefined && p.settings && !p.codeplug && !p.contacts;
}

function settingsOnlyPlan(ctx: RadioPlanContext): PlannedStage[] {
  const overrides = ctx.prepared?.organisation?.rt95SettingsOverrides ?? [];
  const target = ctx.prepared?.organisation?.writeRt95ModData ? 'mm9pdy' : 'stock';
  const patches = overrides.length > 0 ? resolveRt95SettingsPatches(overrides, target) : [];
  const blocks = touchedRt95Blocks(patches);
  const touchedBytes = Math.max(blocks.size, 1) * RT95_BLOCK_SIZE;
  return [
    { label: 'Read settings', weight: IMAGE_BYTES },
    { label: 'Upload', weight: touchedBytes * 2 },
  ];
}

export function planRt95Stages(op: RadioOperation, ctx: RadioPlanContext): PlannedStage[] {
  if (op === 'write') {
    if (isSettingsOnly(ctx)) return settingsOnlyPlan(ctx);
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
