/**
 * Named slots decoded from a radio image for Backup / Restore inspect lists.
 * Decode stays in family codecs; this is only the list row shape.
 */

import type { RadioChannelDto } from './radioChannelDto.ts';

export interface CloneInspectNamedItem {
  slotIndex: number;
  name: string;
}

export function inspectOccupiedChannels(
  channels: readonly RadioChannelDto[],
): CloneInspectNamedItem[] {
  return channels
    .filter((c) => !c.empty)
    .map((c) => ({ slotIndex: c.slotIndex, name: c.wireName }));
}
