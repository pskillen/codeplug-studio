import { isAnalogChannelModeProfile } from '@core/domain/modeProfiles.ts';
import type { Channel, Library } from '@core/models/library.ts';
import { applyMappedReadToChannel, channelFromMappedRead } from './mapReadChannel.ts';
import type { MappedReadChannel } from './types.ts';

export interface ReadChannelUpsertOptions {
  nameCandidatesByChannelId?: ReadonlyMap<string, readonly string[]>;
}
export type ReadChannelMatchKind = 'name' | 'shortened-name';
export interface ReadChannelCreate {
  slot: number;
  channel: Channel;
}
export interface ReadChannelUpdate {
  slot: number;
  before: Channel;
  after: Channel;
  matchedBy: ReadChannelMatchKind;
  changedFields: string[];
}
export interface ReadChannelUnchanged {
  slot: number;
  channelId: string;
  matchedBy: ReadChannelMatchKind;
}
export interface ReadChannelUpsertPlan {
  creates: ReadChannelCreate[];
  updates: ReadChannelUpdate[];
  unchanged: ReadChannelUnchanged[];
  slotToChannelId: Map<number, string>;
}

function changedFields(before: Channel, after: Channel, mapped: MappedReadChannel): string[] {
  const fields: string[] = [];
  const oldProfile = before.modeProfiles.find(
    (p) => isAnalogChannelModeProfile(p) && p.mode === mapped.fields.mode,
  );
  const newProfile = after.modeProfiles.find(
    (p) => isAnalogChannelModeProfile(p) && p.mode === mapped.fields.mode,
  );
  if (!oldProfile && newProfile) fields.push('mode');
  if (
    oldProfile &&
    newProfile &&
    isAnalogChannelModeProfile(oldProfile) &&
    isAnalogChannelModeProfile(newProfile)
  ) {
    if (oldProfile.rxTone !== newProfile.rxTone) fields.push('rxTone');
    if (oldProfile.txTone !== newProfile.txTone) fields.push('txTone');
    if (oldProfile.bandwidthKHz !== newProfile.bandwidthKHz) fields.push('bandwidth');
  }
  if (before.scanInclusion !== after.scanInclusion) fields.push('scanInclusion');
  if (before.forbidTransmit !== after.forbidTransmit) fields.push('forbidTransmit');
  return fields;
}

export function planReadChannelUpsert(
  library: Pick<Library, 'channels'>,
  projectId: string,
  mapped: readonly MappedReadChannel[],
  options?: ReadChannelUpsertOptions,
): ReadChannelUpsertPlan {
  const plan: ReadChannelUpsertPlan = {
    creates: [],
    updates: [],
    unchanged: [],
    slotToChannelId: new Map(),
  };
  const claimed = new Set<string>();
  for (const read of mapped) {
    const eligible = library.channels.filter(
      (c) =>
        !claimed.has(c.id) &&
        c.rxFrequency !== null &&
        c.rxFrequency === read.fields.rxFrequency &&
        (c.txFrequency ?? c.rxFrequency) === read.fields.txFrequency,
    );
    let match = eligible.find((c) => c.name.trim() === read.name);
    let matchedBy: ReadChannelMatchKind = 'name';
    if (!match) {
      match = eligible.find((c) =>
        options?.nameCandidatesByChannelId?.get(c.id)?.some((name) => name.trim() === read.name),
      );
      matchedBy = 'shortened-name';
    }
    if (!match) {
      const channel = channelFromMappedRead(projectId, read);
      plan.creates.push({ slot: read.slot, channel });
      plan.slotToChannelId.set(read.slot, channel.id);
      continue;
    }
    claimed.add(match.id);
    const after = applyMappedReadToChannel(match, read);
    if (Object.is(after, match))
      plan.unchanged.push({ slot: read.slot, channelId: match.id, matchedBy });
    else
      plan.updates.push({
        slot: read.slot,
        before: match,
        after,
        matchedBy,
        changedFields: changedFields(match, after, read),
      });
    plan.slotToChannelId.set(read.slot, match.id);
  }
  return plan;
}
