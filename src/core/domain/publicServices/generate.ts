import { newChannel } from '../factories.ts';
import { defaultModeProfile } from '../modeProfiles.ts';
import type {
  Channel,
  ChannelMode,
  ChannelModeProfile,
  ChannelModeProfileAnalog,
  ChannelModeProfileDMR,
} from '../../models/library.ts';
import type {
  PublicServiceCountry,
  PublicServiceEntry,
  PublicServiceGroup,
  PublicServiceModeSpec,
} from './types.ts';

function profileFromSpec(spec: PublicServiceModeSpec): ChannelModeProfile {
  if (spec.mode === 'fm') {
    const base = defaultModeProfile('fm') as ChannelModeProfileAnalog;
    return {
      ...base,
      ...(spec.bandwidthKHz != null ? { bandwidthKHz: spec.bandwidthKHz } : {}),
      ...(spec.rxTone != null ? { rxTone: spec.rxTone } : {}),
      ...(spec.txTone != null ? { txTone: spec.txTone } : {}),
    };
  }
  const base = defaultModeProfile('dmr') as ChannelModeProfileDMR;
  return {
    ...base,
    ...(spec.colourCode != null ? { colourCode: spec.colourCode } : {}),
    ...(spec.timeslot != null ? { timeslot: spec.timeslot } : {}),
    contactRef: null,
  };
}

function channelComment(group: PublicServiceGroup, entry: PublicServiceEntry): string {
  return group.serviceOrg ? `${group.serviceOrg} — ${entry.label}` : entry.label;
}

function generateChannelFromEntry(
  projectId: string,
  group: PublicServiceGroup,
  entry: PublicServiceEntry,
): Channel | null {
  if (entry.status !== 'active') return null;
  const primary = entry.modes.find((mode) => mode.isPrimary) ?? entry.modes[0];
  if (!primary) return null;

  const modeProfiles = entry.modes.map((spec) => profileFromSpec(spec));
  const base = newChannel(projectId, entry.name);
  return {
    ...base,
    rxFrequency: entry.rxFrequencyHz,
    txFrequency: entry.txFrequencyHz,
    power: null,
    scanInclusion: 'default',
    forbidTransmit: 'forbid',
    txPermit: 'default',
    comment: channelComment(group, entry),
    primaryMode: primary.mode as ChannelMode,
    modeProfiles,
  };
}

export function generateChannelsFromGroups(
  projectId: string,
  country: PublicServiceCountry,
  groupIds: readonly string[],
): Channel[] {
  const selected = new Set(groupIds);
  const channels: Channel[] = [];
  for (const group of country.groups) {
    if (!selected.has(group.groupId)) continue;
    for (const entry of group.entries) {
      const channel = generateChannelFromEntry(projectId, group, entry);
      if (channel) channels.push(channel);
    }
  }
  return channels;
}
