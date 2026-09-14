import type { Channel } from '../../models/library.ts';

export interface PublicServiceDedupAdvisory {
  channel: Channel;
  existingName: string;
  rxFrequencyHz: number;
}

export interface PublicServiceDedupResult {
  toAdd: Channel[];
  skippedByName: Channel[];
  advisories: PublicServiceDedupAdvisory[];
}

function normaliseName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Classify generated public-service channels against the library.
 * Name identity (case/whitespace normalised) is the skip rule. An RX-frequency
 * collision with a differently named library channel is an advisory, not a skip.
 * Generated entries never suppress each other on frequency within one run.
 */
export function classifyPublicServiceDedup(
  existingChannels: Channel[],
  generated: Channel[],
): PublicServiceDedupResult {
  const existingByName = new Map<string, Channel>();
  const existingByRx = new Map<number, Channel[]>();
  for (const channel of existingChannels) {
    existingByName.set(normaliseName(channel.name), channel);
    if (channel.rxFrequency != null) {
      const list = existingByRx.get(channel.rxFrequency) ?? [];
      list.push(channel);
      existingByRx.set(channel.rxFrequency, list);
    }
  }

  const toAdd: Channel[] = [];
  const skippedByName: Channel[] = [];
  const advisories: PublicServiceDedupAdvisory[] = [];
  const namesThisRun = new Set<string>();

  for (const channel of generated) {
    const key = normaliseName(channel.name);
    if (existingByName.has(key) || namesThisRun.has(key)) {
      skippedByName.push(channel);
      continue;
    }
    namesThisRun.add(key);
    toAdd.push(channel);

    if (channel.rxFrequency == null) continue;
    const collisions = existingByRx.get(channel.rxFrequency) ?? [];
    const other = collisions.find((existing) => normaliseName(existing.name) !== key);
    if (other) {
      advisories.push({
        channel,
        existingName: other.name,
        rxFrequencyHz: channel.rxFrequency,
      });
    }
  }

  return { toAdd, skippedByName, advisories };
}
