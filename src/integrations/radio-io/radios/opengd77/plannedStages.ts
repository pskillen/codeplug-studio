/**
 * OpenGD77 planned stages (#1393), shared by the DM-1701 and MD-9600 profiles. Labels equal what a
 * Write emits: 'Pre-write read' (the session's read, and again inside `upload()`), 'FLASH sectors'
 * (dirty 4 KiB sectors; a no-change Write emits it once with a message), and 'User Database' when
 * the projection carries User Database contacts. Weights are bytes: the whole registered FLASH
 * span read, and an estimate of the dirty sectors written.
 */

import type { PlannedStage, RadioOperation, RadioPlanContext } from '../../types.ts';
import {
  OPENGD77_SECTOR,
  OPENUV380_FLASH_SPANS,
  OPENUV380_USER_DB_ENTRY_SIZE,
} from './constants.ts';

const FLASH_BYTES = OPENUV380_FLASH_SPANS.reduce((sum, s) => sum + s.length, 0);
/** Channel record size in the OpenUV380 channel banks. */
const CHANNEL_RECORD_BYTES = 56;
/** Sectors a Write nominally dirties besides channels: settings, zones, contacts index. */
const FIXED_DIRTY_SECTORS = 4;

export function planOpenGd77Stages(op: RadioOperation, ctx: RadioPlanContext): PlannedStage[] {
  if (op !== 'write') return [];
  const channels = ctx.prepared?.channels.length ?? 200;
  const dirtySectors =
    FIXED_DIRTY_SECTORS + Math.ceil((channels * CHANNEL_RECORD_BYTES) / OPENGD77_SECTOR);
  const stages: PlannedStage[] = [
    { label: 'Pre-write read', weight: 2 * FLASH_BYTES, passes: 2 },
    { label: 'FLASH sectors', weight: dirtySectors * OPENGD77_SECTOR },
  ];
  const userDb = ctx.prepared?.organisation.userDatabaseContacts;
  const wantsUserDb = ctx.parts ? ctx.parts.contacts : (userDb?.length ?? 0) > 0;
  if (wantsUserDb) {
    stages.push({
      label: 'User Database',
      weight: Math.max(OPENGD77_SECTOR, (userDb?.length ?? 0) * OPENUV380_USER_DB_ENTRY_SIZE),
      ...(userDb && userDb.length > 0 ? {} : { optional: true }),
    });
  }
  return stages;
}
