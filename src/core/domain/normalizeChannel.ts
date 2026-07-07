import type { Channel, ScanInclusion } from '../models/library.ts';
import { scanInclusionFromLegacyBoolean } from '@core/import-export/scanInclusion/index.ts';
import { normalizeModeProfile } from './modeProfiles.ts';

type LegacyChannel = Channel & { scanSkip?: boolean };

function resolveScanInclusion(channel: LegacyChannel): ScanInclusion {
  if (channel.scanInclusion != null) return channel.scanInclusion;
  if (channel.scanSkip !== undefined) return scanInclusionFromLegacyBoolean(channel.scanSkip);
  return 'default';
}

/** Upgrade persisted channel rows after schema bumps or legacy stub profiles. */
export function normalizeChannel(channel: LegacyChannel): Channel {
  const { scanSkip: _legacy, ...rest } = channel;
  return {
    ...rest,
    scanInclusion: resolveScanInclusion(channel),
    maidenheadLocator: channel.maidenheadLocator ?? null,
    modeProfiles: (channel.modeProfiles ?? []).map(normalizeModeProfile),
  };
}
