import type { Channel } from '../../models/library.ts';
import type { ChannelSetDedupResult } from './types.ts';

function existingRxHzSet(channels: Channel[]): Set<number> {
  const set = new Set<number>();
  for (const ch of channels) {
    if (ch.rxFrequency != null) {
      set.add(ch.rxFrequency);
    }
  }
  return set;
}

function existingNameSet(channels: Channel[]): Set<string> {
  return new Set(channels.map((ch) => ch.name));
}

/**
 * Classify generated channels against the library — skip duplicates by RX Hz (primary) or name.
 */
export function classifyChannelSetDedup(
  existingChannels: Channel[],
  generated: Channel[],
): ChannelSetDedupResult {
  const rxHz = existingRxHzSet(existingChannels);
  const names = existingNameSet(existingChannels);

  const toAdd: Channel[] = [];
  const skippedByRxHz: Channel[] = [];
  const skippedByName: Channel[] = [];

  for (const ch of generated) {
    if (ch.rxFrequency != null && rxHz.has(ch.rxFrequency)) {
      skippedByRxHz.push(ch);
      continue;
    }
    if (names.has(ch.name)) {
      skippedByName.push(ch);
      continue;
    }
    toAdd.push(ch);
    if (ch.rxFrequency != null) {
      rxHz.add(ch.rxFrequency);
    }
    names.add(ch.name);
  }

  return { toAdd, skippedByRxHz, skippedByName };
}
