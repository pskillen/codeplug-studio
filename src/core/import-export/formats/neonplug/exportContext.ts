import type { EntityRef } from '@core/models/libraryTypes.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';

/**
 * Channel UUID → NeonPlug channel `number` for DM32UV sequential export (1…N in assemble order).
 * Truncates at `maxChannels` to match channel serialisation.
 */
export function buildDm32uvChannelNumberMap(
  assembled: AssembledBuild,
  maxChannels: number,
): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < assembled.channels.length && map.size < maxChannels; i++) {
    const row = assembled.channels[i]!;
    map.set(row.entity.id, i + 1);
  }
  return map;
}

/**
 * UV5R-Mini: channel UUID → memory slot `number` from assemble slots (blanks omitted).
 * Falls back to sequential 1…N when slots are absent.
 */
export function buildUv5rminiChannelNumberMap(
  assembled: AssembledBuild,
  maxMemorySlots: number,
): Map<string, number> {
  const map = new Map<string, number>();
  const memorySlots = assembled.channelMemorySlots;
  if (memorySlots && memorySlots.length > 0) {
    for (const slot of memorySlots) {
      if (slot.channelId == null) continue;
      if (slot.slot > maxMemorySlots) continue;
      if (map.size >= maxMemorySlots) break;
      if (!map.has(slot.channelId)) {
        map.set(slot.channelId, slot.slot);
      }
    }
    return map;
  }
  for (let i = 0; i < assembled.channels.length && map.size < maxMemorySlots; i++) {
    const row = assembled.channels[i]!;
    map.set(row.entity.id, i + 1);
  }
  return map;
}

/** Resolve Studio `EntityRef` → NeonPlug contacts-book id (`0` = none). */
export function resolveContactBookId(
  ref: EntityRef | null | undefined,
  contactIdByEntityId: Map<string, number>,
): number {
  if (!ref) return 0;
  if (ref.kind !== 'talkGroup' && ref.kind !== 'digitalContact') return 0;
  return contactIdByEntityId.get(ref.id) ?? 0;
}

/** Resolve RX group list UUID → 1-based NeonPlug `rxGroupListId` (`0` = none). */
export function resolveRxGroupListId(
  rxGroupListId: string | null | undefined,
  rxGroupIndexById: Map<string, number>,
): number {
  if (!rxGroupListId) return 0;
  return rxGroupIndexById.get(rxGroupListId) ?? 0;
}

/** Unique ordered channel numbers from member UUIDs (skips unknown / unmapped). */
export function channelNumbersForMembers(
  memberChannelIds: readonly string[],
  channelNumberById: Map<string, number>,
): number[] {
  const seen = new Set<number>();
  const numbers: number[] = [];
  for (const channelId of memberChannelIds) {
    const n = channelNumberById.get(channelId);
    if (n == null || seen.has(n)) continue;
    seen.add(n);
    numbers.push(n);
  }
  return numbers;
}
