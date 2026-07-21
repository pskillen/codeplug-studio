import type { EntityRef } from '@core/models/libraryTypes.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import type { ExpandedNeonplugChannelRow } from './channelExpansion.ts';

/**
 * Channel UUID → NeonPlug channel `number` for DM32UV sequential export (1…N in assemble order).
 * Truncates at `maxChannels` to match channel serialisation.
 * Prefer {@link assignNeonplugExpandedChannelNumbers} when m×n expansion is enabled.
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

/** Wrap a 1:1 UUID→number map as UUID→number[] for zone/scan fan-out helpers. */
export function singletonChannelNumbersById(
  channelNumberById: ReadonlyMap<string, number>,
): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const [id, n] of channelNumberById) {
    map.set(id, [n]);
  }
  return map;
}

export interface NumberedNeonplugChannelRow {
  row: ExpandedNeonplugChannelRow;
  number: number;
}

/**
 * Assign sequential NeonPlug channel numbers 1…N to expanded export rows.
 * Truncates at `maxChannels`; builds source UUID → all projected numbers.
 */
export function assignNeonplugExpandedChannelNumbers(
  expandedRows: readonly ExpandedNeonplugChannelRow[],
  maxChannels: number,
  warnings: string[] = [],
  profileLabel = 'NeonPlug',
): {
  numbered: NumberedNeonplugChannelRow[];
  numbersBySourceChannelId: Map<string, number[]>;
} {
  const numbered: NumberedNeonplugChannelRow[] = [];
  const numbersBySourceChannelId = new Map<string, number[]>();
  if (expandedRows.length > maxChannels) {
    warnings.push(
      `Truncated ${expandedRows.length - maxChannels} expanded channel(s) to fit ${maxChannels} channels for ${profileLabel}`,
    );
  }
  const limit = Math.min(expandedRows.length, maxChannels);
  for (let i = 0; i < limit; i++) {
    const row = expandedRows[i]!;
    const number = i + 1;
    numbered.push({ row, number });
    const list = numbersBySourceChannelId.get(row.sourceChannelId) ?? [];
    list.push(number);
    numbersBySourceChannelId.set(row.sourceChannelId, list);
  }
  return { numbered, numbersBySourceChannelId };
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
