import type { Channel } from '@core/models/library.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import { pushGeneralWarning, type ExportWarning } from '@core/import-export/exportWarning.ts';

/** True when the channel has an FM, AM or DMR profile: something the stock Anytone channel record can carry alone. */
export function hasAnytoneStockModeProfile(channel: Pick<Channel, 'modeProfiles'>): boolean {
  return channel.modeProfiles.some(
    (profile) => profile.mode === 'fm' || profile.mode === 'am' || profile.mode === 'dmr',
  );
}

/** True when the channel has an NXDN profile and no FM, AM or DMR profile. */
export function isNxdnOnlyChannel(channel: Pick<Channel, 'modeProfiles'>): boolean {
  return (
    channel.modeProfiles.some((profile) => profile.mode === 'nxdn') &&
    !hasAnytoneStockModeProfile(channel)
  );
}

/**
 * Drop channels whose only profile is NXDN. The MM9PDY target accepts them (it can carry NXDN),
 * but a Write to a radio that does not report NXDN enabled, and the Anytone CSV export, have
 * nowhere to put them. `warnings` is omitted when the caller reports the skip itself.
 */
export function dropNxdnOnlyChannels(
  assembled: AssembledBuild,
  warnings?: ExportWarning[],
): AssembledBuild {
  const kept = assembled.channels.filter((row) => !isNxdnOnlyChannel(row.entity));
  const dropped = assembled.channels.length - kept.length;
  if (dropped === 0) return assembled;
  if (warnings) {
    pushGeneralWarning(
      warnings,
      `${dropped} NXDN-only channel(s) not exported: this export does not carry NXDN.`,
    );
  }
  return { ...assembled, channels: kept };
}
