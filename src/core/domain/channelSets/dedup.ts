import type { Channel } from '../../models/library.ts';
import type { ChannelSetDedupResult } from './types.ts';

/** RX Hz is compared per mode family so a DMR set does not collide with analogue channels on the same frequency. */
function rxKey(mode: string, hz: number): string {
  return `${mode}:${hz}`;
}

function existingRxHzSet(channels: Channel[]): Set<string> {
  const set = new Set<string>();
  for (const ch of channels) {
    if (ch.rxFrequency == null) continue;
    const modes = ch.modeProfiles.length > 0 ? ch.modeProfiles.map((p) => p.mode) : ['fm'];
    for (const mode of modes) set.add(rxKey(mode, ch.rxFrequency));
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
    const key =
      ch.rxFrequency != null ? rxKey(ch.modeProfiles[0]?.mode ?? 'fm', ch.rxFrequency) : null;
    if (key != null && rxHz.has(key)) {
      skippedByRxHz.push(ch);
      continue;
    }
    if (names.has(ch.name)) {
      skippedByName.push(ch);
      continue;
    }
    toAdd.push(ch);
    if (key != null) rxHz.add(key);
    names.add(ch.name);
  }

  return { toAdd, skippedByRxHz, skippedByName };
}
