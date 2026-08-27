import type {
  Channel,
  ChannelModeProfileAnalog,
  ChannelModeProfileDMR,
  ChannelTone,
  ScanInclusion,
} from '../models/library.ts';
import type {
  AnalogSquelchModeOverride,
  ForbidTransmitOverride,
  SendTalkerAliasOverride,
  TxPermitOverride,
} from '../models/channelBehaviourDefaults.ts';
import {
  channelHasAnalogProfile,
  channelHasDmrProfile,
  isAnalogChannelModeProfile,
  patchAllAnalogProfiles,
  patchAllDmrProfiles,
} from './modeProfiles.ts';

export type ChannelBulkEditPatch = {
  scanInclusion?: ScanInclusion;
  forbidTransmit?: ForbidTransmitOverride;
  txPermit?: TxPermitOverride;
  /** Applied to every DMR mode profile on the channel. */
  sendTalkerAlias?: SendTalkerAliasOverride;
  /** Applied to every analog mode profile on the channel. */
  analogSquelchMode?: AnalogSquelchModeOverride;
  /** `null` = radio default (no fixed level). */
  power?: number | null;
  /** `null` = open / radio-default squelch on analog profiles. */
  analogSquelch?: number | null;
  /** Applied to every analog mode profile. `'none'` clears the tone. */
  rxTone?: ChannelTone;
  /** Applied to every analog mode profile. `'none'` clears the tone. */
  txTone?: ChannelTone;
};

export type ChannelBulkEditPatchKey = keyof ChannelBulkEditPatch;

export type ChannelBulkEditSkipReason = 'no_analog_profile' | 'no_dmr_profile';

export interface ChannelBulkEditFieldImpact {
  appliesTo: number;
  skipped: number;
  skipReason?: ChannelBulkEditSkipReason;
}

export type ChannelBulkEditImpact = Partial<
  Record<ChannelBulkEditPatchKey, ChannelBulkEditFieldImpact>
>;

const CHANNEL_LEVEL_KEYS = new Set<ChannelBulkEditPatchKey>([
  'scanInclusion',
  'forbidTransmit',
  'txPermit',
  'power',
]);

export function countChannelsWithAnalogProfile(channels: readonly Channel[]): number {
  return channels.filter(channelHasAnalogProfile).length;
}

export function countChannelsWithDmrProfile(channels: readonly Channel[]): number {
  return channels.filter(channelHasDmrProfile).length;
}

export function applyChannelBulkPatch(channel: Channel, patch: ChannelBulkEditPatch): Channel {
  let result = channel;

  if ('scanInclusion' in patch) {
    result = { ...result, scanInclusion: patch.scanInclusion! };
  }
  if ('forbidTransmit' in patch) {
    result = { ...result, forbidTransmit: patch.forbidTransmit! };
  }
  if ('txPermit' in patch) {
    result = { ...result, txPermit: patch.txPermit! };
  }
  if ('sendTalkerAlias' in patch) {
    result = {
      ...result,
      modeProfiles: patchAllDmrProfiles(result, {
        sendTalkerAlias: patch.sendTalkerAlias!,
      }),
    };
  }
  if ('analogSquelchMode' in patch) {
    result = {
      ...result,
      modeProfiles: patchAllAnalogProfiles(result, {
        analogSquelchMode: patch.analogSquelchMode!,
      }),
    };
  }
  if ('power' in patch) {
    result = { ...result, power: patch.power ?? null };
  }
  if ('analogSquelch' in patch) {
    result = {
      ...result,
      modeProfiles: patchAllAnalogProfiles(result, {
        squelch: patch.analogSquelch ?? null,
      } satisfies Partial<ChannelModeProfileAnalog>),
    };
  }
  if ('rxTone' in patch) {
    result = {
      ...result,
      modeProfiles: patchAllAnalogProfiles(result, { rxTone: patch.rxTone! }),
    };
  }
  if ('txTone' in patch) {
    result = {
      ...result,
      modeProfiles: patchAllAnalogProfiles(result, { txTone: patch.txTone! }),
    };
  }

  return result;
}

export function channelBulkEditWouldChange(channel: Channel, patch: ChannelBulkEditPatch): boolean {
  if ('scanInclusion' in patch && channel.scanInclusion !== patch.scanInclusion) {
    return true;
  }
  if ('forbidTransmit' in patch && channel.forbidTransmit !== patch.forbidTransmit) {
    return true;
  }
  if ('txPermit' in patch && channel.txPermit !== patch.txPermit) {
    return true;
  }
  if ('sendTalkerAlias' in patch) {
    if (!channelHasDmrProfile(channel)) return false;
    return channel.modeProfiles.some(
      (profile) => profile.mode === 'dmr' && profile.sendTalkerAlias !== patch.sendTalkerAlias,
    );
  }
  if ('analogSquelchMode' in patch) {
    if (!channelHasAnalogProfile(channel)) return false;
    return channel.modeProfiles.some(
      (profile) =>
        isAnalogChannelModeProfile(profile) &&
        profile.analogSquelchMode !== patch.analogSquelchMode,
    );
  }
  if ('power' in patch && channel.power !== (patch.power ?? null)) {
    return true;
  }
  if ('analogSquelch' in patch) {
    if (!channelHasAnalogProfile(channel)) {
      return false;
    }
    const squelch = patch.analogSquelch ?? null;
    return channel.modeProfiles.some(
      (profile) => isAnalogChannelModeProfile(profile) && profile.squelch !== squelch,
    );
  }
  if ('rxTone' in patch) {
    if (!channelHasAnalogProfile(channel)) return false;
    return channel.modeProfiles.some(
      (profile) => isAnalogChannelModeProfile(profile) && profile.rxTone !== patch.rxTone,
    );
  }
  if ('txTone' in patch) {
    if (!channelHasAnalogProfile(channel)) return false;
    return channel.modeProfiles.some(
      (profile) => isAnalogChannelModeProfile(profile) && profile.txTone !== patch.txTone,
    );
  }
  return false;
}

export function sharedEqualValue<T>(values: readonly T[]): T | undefined {
  if (values.length === 0) return undefined;
  const first = values[0];
  return values.every((value) => Object.is(value, first)) ? first : undefined;
}

export function sharedChannelField<T>(
  channels: readonly Channel[],
  read: (channel: Channel) => T,
): T | undefined {
  return sharedEqualValue(channels.map(read));
}

export function analogProfilesOnChannels(channels: readonly Channel[]): ChannelModeProfileAnalog[] {
  return channels.flatMap((channel) => channel.modeProfiles.filter(isAnalogChannelModeProfile));
}

export function dmrProfilesOnChannels(channels: readonly Channel[]): ChannelModeProfileDMR[] {
  return channels.flatMap((channel) =>
    channel.modeProfiles.filter((profile): profile is ChannelModeProfileDMR => profile.mode === 'dmr'),
  );
}

export function sharedAnalogField<T>(
  channels: readonly Channel[],
  read: (profile: ChannelModeProfileAnalog) => T,
): T | undefined {
  return sharedEqualValue(analogProfilesOnChannels(channels).map(read));
}

export function sharedDmrField<T>(
  channels: readonly Channel[],
  read: (profile: ChannelModeProfileDMR) => T,
): T | undefined {
  return sharedEqualValue(dmrProfilesOnChannels(channels).map(read));
}

export function analyzeChannelBulkEditImpact(
  channels: readonly Channel[],
  patch: ChannelBulkEditPatch,
): ChannelBulkEditImpact {
  const total = channels.length;
  const impact: ChannelBulkEditImpact = {};

  for (const key of Object.keys(patch) as ChannelBulkEditPatchKey[]) {
    if (key === 'analogSquelch' || key === 'analogSquelchMode' || key === 'rxTone' || key === 'txTone') {
      const appliesTo = countChannelsWithAnalogProfile(channels);
      impact[key] = {
        appliesTo,
        skipped: total - appliesTo,
        skipReason: total - appliesTo > 0 ? 'no_analog_profile' : undefined,
      };
      continue;
    }
    if (key === 'sendTalkerAlias') {
      const appliesTo = countChannelsWithDmrProfile(channels);
      impact.sendTalkerAlias = {
        appliesTo,
        skipped: total - appliesTo,
        skipReason: total - appliesTo > 0 ? 'no_dmr_profile' : undefined,
      };
      continue;
    }
    if (CHANNEL_LEVEL_KEYS.has(key)) {
      impact[key] = { appliesTo: total, skipped: 0 };
    }
  }

  return impact;
}
