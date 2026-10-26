/**
 * DM-32UV planned stages (#1393). Labels equal what a Write emits: 'Discover memory map' (read,
 * then again before upload), 'Pre-write read' (the session's content read), then the dirty-block
 * groups `groupDm32BlocksForProgress` names ('Channels' … 'Settings & other'). Groups appear only
 * when they hold blocks, so all but 'Channels' are optional. Weights are 4 KiB blocks estimated
 * from the projection (an estimate; the real set is known once the live map is discovered).
 */

import type { PlannedStage, RadioOperation, RadioPlanContext } from '../../types.ts';
import { DM32_BLOCK_SIZE, DM32_CHANNEL_RECORD_SIZE } from './constants.ts';

/** Bytes moved by one pass of memory-map discovery (one probe byte per block, with framing). */
const DISCOVER_BYTES = 0x1000;
/** Fixed settings / VFO / calibration-adjacent pages every codeplug carries. */
const SETTINGS_BLOCKS = 6;

function blocks(records: number, recordBytes: number): number {
  return Math.max(1, Math.ceil((records * recordBytes) / DM32_BLOCK_SIZE));
}

export function planDm32Stages(op: RadioOperation, ctx: RadioPlanContext): PlannedStage[] {
  if (op !== 'write') return [];
  const channels = ctx.prepared?.channels.length ?? 200;
  const org = ctx.prepared?.organisation;
  const channelBlocks = blocks(channels, DM32_CHANNEL_RECORD_SIZE);
  const zoneBlocks = Math.max(1, org?.zones ? Math.ceil(org.zones.length / 4) : 3);
  const scanBlocks = Math.max(1, org?.scanLists ? Math.ceil(org.scanLists.length / 8) : 1);
  const tgBlocks = blocks(org?.talkGroups?.length ?? 50, 64);
  const rxBlocks = blocks(org?.rxGroups?.length ?? 10, 256);
  const groups: PlannedStage[] = [
    { label: 'Channels', weight: channelBlocks * DM32_BLOCK_SIZE },
    { label: 'Zones', weight: zoneBlocks * DM32_BLOCK_SIZE, optional: true },
    { label: 'Scan lists', weight: scanBlocks * DM32_BLOCK_SIZE, optional: true },
    { label: 'Talk groups', weight: tgBlocks * DM32_BLOCK_SIZE, optional: true },
    { label: 'RX groups', weight: rxBlocks * DM32_BLOCK_SIZE, optional: true },
    { label: 'TX contact index', weight: 2 * DM32_BLOCK_SIZE, optional: true },
    { label: 'Channel positions', weight: 2 * DM32_BLOCK_SIZE, optional: true },
    { label: 'Settings & other', weight: SETTINGS_BLOCKS * DM32_BLOCK_SIZE, optional: true },
  ];
  const readBytes = groups.reduce((sum, g) => sum + g.weight, 0);
  return [
    { label: 'Discover memory map', weight: 2 * DISCOVER_BYTES },
    { label: 'Pre-write read', weight: readBytes },
    ...groups,
  ];
}
