import type { Channel, ScanInclusion } from '../models/library.ts';
import type { ChannelMode } from '../models/libraryTypes.ts';
import { scanInclusionFromLegacyBoolean } from '@core/import-export/scanInclusion/index.ts';
import { dedupeSsbModeProfiles, normalizeModeProfile } from './modeProfiles.ts';
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

type LegacyChannel = Channel & { scanSkip?: boolean };

function resolveScanInclusion(channel: LegacyChannel): ScanInclusion {
  if (channel.scanInclusion != null) return channel.scanInclusion;
  if (channel.scanSkip !== undefined) return scanInclusionFromLegacyBoolean(channel.scanSkip);
  return 'default';
}

/** Upgrade persisted channel rows after schema bumps or legacy stub profiles. */
export function normalizeChannel(channel: LegacyChannel): Channel {
  const { scanSkip: _scanSkip, ...rest } = channel;
  void _scanSkip;
  return {
    ...rest,
    scanInclusion: resolveScanInclusion(channel),
    scanListId: channel.scanListId?.trim() || undefined,
    maidenheadLocator: channel.maidenheadLocator ?? null,
    primaryMode: normalizePrimaryMode(channel.primaryMode ?? null),
    modeProfiles: dedupeSsbModeProfiles((channel.modeProfiles ?? []).map(normalizeModeProfile)),
    aprs: normalizeOptionalChannelAprs(channel.aprs),
  };
}
