import type { Channel, ChannelModeProfileDMR } from '../models/library.ts';
import type { DmrOperatingMode } from '../models/libraryTypes.ts';
import { DEFAULT_MODE_PROFILE_BEHAVIOUR_OVERRIDES } from '../models/channelBehaviourDefaults.ts';
import { findDmrProfile } from './modeProfiles.ts';

const DMR_OPERATING_MODES = new Set<DmrOperatingMode>(['dmo-simplex', 'repeater']);

export function isDmrOperatingMode(value: string): value is DmrOperatingMode {
  return DMR_OPERATING_MODES.has(value as DmrOperatingMode);
}

export function normalizeDmrOperatingMode(value: unknown): DmrOperatingMode | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && isDmrOperatingMode(value)) return value;
  return null;
}

/** Infer DMR operating mode from channel RX/TX when profile `dmrMode` is unset. */
export function inferDmrOperatingMode(
  channel: Pick<Channel, 'rxFrequency' | 'txFrequency'>,
): DmrOperatingMode {
  const { rxFrequency, txFrequency } = channel;
  if (rxFrequency == null || txFrequency == null) return 'dmo-simplex';
  return rxFrequency === txFrequency ? 'dmo-simplex' : 'repeater';
}

/** Explicit DMR profile `dmrMode` wins; otherwise infer from frequencies. */
export function resolveDmrOperatingMode(
  channel: Pick<Channel, 'rxFrequency' | 'txFrequency' | 'modeProfiles'>,
): DmrOperatingMode {
  const profile = findDmrProfile(channel);
  if (profile?.dmrMode != null) return profile.dmrMode;
  return inferDmrOperatingMode(channel);
}

export function normalizeDmrModeProfile(profile: ChannelModeProfileDMR): ChannelModeProfileDMR {
  return {
    ...profile,
    dmrMode: normalizeDmrOperatingMode(profile.dmrMode ?? null),
    sendTalkerAlias:
      profile.sendTalkerAlias ?? DEFAULT_MODE_PROFILE_BEHAVIOUR_OVERRIDES.sendTalkerAlias,
  };
}
