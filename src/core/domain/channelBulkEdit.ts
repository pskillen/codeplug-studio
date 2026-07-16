import type { Channel, ChannelModeProfileAnalog, ScanInclusion } from '../models/library.ts';
import type {
  AnalogSquelchModeOverride,
  ForbidTransmitOverride,
  SendTalkerAliasOverride,
  TxPermitOverride,
} from '../models/channelBehaviourDefaults.ts';
import {
  channelHasAnalogProfile,
  isAnalogChannelModeProfile,
  patchAllAnalogProfiles,
} from './modeProfiles.ts';

export type ChannelBulkEditPatch = {
  scanInclusion?: ScanInclusion;
  forbidTransmit?: ForbidTransmitOverride;
  txPermit?: TxPermitOverride;
  sendTalkerAlias?: SendTalkerAliasOverride;
  analogSquelchMode?: AnalogSquelchModeOverride;
  /** `null` = radio default (no fixed level). */
  power?: number | null;
  /** `null` = open / radio-default squelch on analog profiles. */
  analogSquelch?: number | null;
};

export type ChannelBulkEditPatchKey = keyof ChannelBulkEditPatch;

export type ChannelBulkEditSkipReason = 'no_analog_profile';

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
  'sendTalkerAlias',
  'analogSquelchMode',
  'power',
]);

export function countChannelsWithAnalogProfile(channels: readonly Channel[]): number {
  return channels.filter(channelHasAnalogProfile).length;
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
    result = { ...result, sendTalkerAlias: patch.sendTalkerAlias! };
  }
  if ('analogSquelchMode' in patch) {
    result = { ...result, analogSquelchMode: patch.analogSquelchMode! };
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
  if ('sendTalkerAlias' in patch && channel.sendTalkerAlias !== patch.sendTalkerAlias) {
    return true;
  }
  if ('analogSquelchMode' in patch && channel.analogSquelchMode !== patch.analogSquelchMode) {
    return true;
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
  return false;
}

export function analyzeChannelBulkEditImpact(
  channels: readonly Channel[],
  patch: ChannelBulkEditPatch,
): ChannelBulkEditImpact {
  const total = channels.length;
  const impact: ChannelBulkEditImpact = {};

  for (const key of Object.keys(patch) as ChannelBulkEditPatchKey[]) {
    if (key === 'analogSquelch') {
      const appliesTo = countChannelsWithAnalogProfile(channels);
      impact.analogSquelch = {
        appliesTo,
        skipped: total - appliesTo,
        skipReason: total - appliesTo > 0 ? 'no_analog_profile' : undefined,
      };
      continue;
    }
    if (CHANNEL_LEVEL_KEYS.has(key)) {
      impact[key] = { appliesTo: total, skipped: 0 };
    }
  }

  return impact;
}
