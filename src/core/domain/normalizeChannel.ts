import type { Channel } from '../models/library.ts';
import { normalizeModeProfile } from './modeProfiles.ts';

/** Upgrade persisted channel rows after schema bumps or legacy stub profiles. */
export function normalizeChannel(channel: Channel): Channel {
  return {
    ...channel,
    maidenheadLocator: channel.maidenheadLocator ?? null,
    modeProfiles: (channel.modeProfiles ?? []).map(normalizeModeProfile),
  };
}
