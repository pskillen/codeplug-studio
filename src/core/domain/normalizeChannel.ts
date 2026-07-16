import type { Channel, ScanInclusion } from '../models/library.ts';
import type { ChannelMode } from '../models/libraryTypes.ts';
import type {
  AnalogSquelchModeOverride,
  ForbidTransmitOverride,
  SendTalkerAliasOverride,
} from '../models/channelBehaviourDefaults.ts';
import { scanInclusionFromLegacyBoolean } from '@core/import-export/scanInclusion/index.ts';
import { forbidTransmitFromLegacyBoolean } from '@core/import-export/channelBehaviourDefaults/index.ts';
import { defaultChannelBehaviourOverrides } from '@core/import-export/channelBehaviourDefaults/resolve.ts';
import {
  dedupeSsbModeProfiles,
  isAnalogChannelModeProfile,
  normalizeModeProfile,
} from './modeProfiles.ts';
import { normalizeOptionalChannelAprs } from './aprs/index.ts';

const CHANNEL_MODES = new Set<ChannelMode>([
  'fm',
  'am',
  'ssb',
  'dmr',
  'dstar',
  'ysf',
  'p25',
  'nxdn',
  'm17',
  'tetra',
]);

function normalizePrimaryMode(primaryMode: ChannelMode | null | undefined): ChannelMode | null {
  if (primaryMode == null) return null;
  return CHANNEL_MODES.has(primaryMode) ? primaryMode : null;
}

type LegacyChannel = Channel & {
  scanSkip?: boolean;
  forbidTransmit?: boolean | ForbidTransmitOverride;
  /** Pre-profile-move channel-level fields — migrated onto mode profiles. */
  sendTalkerAlias?: SendTalkerAliasOverride;
  analogSquelchMode?: AnalogSquelchModeOverride;
};

function resolveScanInclusion(channel: LegacyChannel): ScanInclusion {
  if (channel.scanInclusion != null) return channel.scanInclusion;
  if (channel.scanSkip !== undefined) return scanInclusionFromLegacyBoolean(channel.scanSkip);
  return 'default';
}

function resolveForbidTransmit(channel: LegacyChannel): ForbidTransmitOverride {
  const value = channel.forbidTransmit;
  if (value === 'default' || value === 'allow' || value === 'forbid') return value;
  if (typeof value === 'boolean') return forbidTransmitFromLegacyBoolean(value);
  return 'default';
}

function migrateLegacyBehaviourOntoProfiles(
  profiles: Channel['modeProfiles'],
  legacy: Pick<LegacyChannel, 'sendTalkerAlias' | 'analogSquelchMode'>,
): Channel['modeProfiles'] {
  return profiles.map((profile) => {
    if (isAnalogChannelModeProfile(profile)) {
      return {
        ...profile,
        analogSquelchMode: profile.analogSquelchMode ?? legacy.analogSquelchMode ?? 'default',
      };
    }
    if (profile.mode === 'dmr') {
      return {
        ...profile,
        sendTalkerAlias: profile.sendTalkerAlias ?? legacy.sendTalkerAlias ?? 'default',
      };
    }
    return profile;
  });
}

/** Upgrade persisted channel rows after schema bumps or legacy stub profiles. */
export function normalizeChannel(channel: LegacyChannel): Channel {
  const {
    scanSkip: _scanSkip,
    sendTalkerAlias: legacySendTalkerAlias,
    analogSquelchMode: legacyAnalogSquelchMode,
    aprs: _legacyAprs,
    ...rest
  } = channel;
  void _scanSkip;
  void _legacyAprs;
  const behaviourDefaults = defaultChannelBehaviourOverrides();
  const modeProfiles = migrateLegacyBehaviourOntoProfiles(
    dedupeSsbModeProfiles((channel.modeProfiles ?? []).map(normalizeModeProfile)),
    {
      sendTalkerAlias: legacySendTalkerAlias,
      analogSquelchMode: legacyAnalogSquelchMode,
    },
  );
  const normalizedAprs = normalizeOptionalChannelAprs(channel.aprs);
  return {
    ...rest,
    scanInclusion: resolveScanInclusion(channel),
    forbidTransmit: resolveForbidTransmit(channel),
    txPermit: channel.txPermit ?? behaviourDefaults.txPermit,
    scanListId: channel.scanListId?.trim() || undefined,
    maidenheadLocator: channel.maidenheadLocator ?? null,
    primaryMode: normalizePrimaryMode(channel.primaryMode ?? null),
    modeProfiles,
    ...(normalizedAprs !== undefined ? { aprs: normalizedAprs } : {}),
  };
}
