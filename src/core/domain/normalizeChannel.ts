import type { Channel, ScanInclusion } from '../models/library.ts';
import { scanInclusionFromLegacyBoolean } from '@core/import-export/scanInclusion/index.ts';
import { dedupeSsbModeProfiles, normalizeModeProfile } from './modeProfiles.ts';

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
    maidenheadLocator: channel.maidenheadLocator ?? null,
    modeProfiles: dedupeSsbModeProfiles(
      (channel.modeProfiles ?? []).map(normalizeModeProfile),
    ),
  };
}
