import { bandFromFrequencyMhz } from '@core/domain/bandCatalog.ts';
import type { Channel } from '@core/models/library.ts';
import type { AssembledBuild, AssembledChannel } from '@core/services/assemble.ts';

const AIRBAND_BAND_ID = 'airband';
const FM_BROADCAST_BAND_ID = 'fm-broadcast';

export function isReceiveOnlyChannel(
  channel: Pick<Channel, 'forbidTransmit' | 'txFrequency'>,
): boolean {
  return channel.forbidTransmit || channel.txFrequency == null;
}

function primaryMode(channel: Channel): string | null {
  return channel.modeProfiles[0]?.mode ?? null;
}

function bandIdForRxHz(rxFrequencyHz: number | null): string | null {
  if (rxFrequencyHz == null) return null;
  return bandFromFrequencyMhz(rxFrequencyHz / 1_000_000)?.id ?? null;
}

/** Receive-only AM channel in civil airband (118–137 MHz). */
export function isAmAirbandBankChannel(channel: Channel): boolean {
  if (!isReceiveOnlyChannel(channel)) return false;
  if (!channel.modeProfiles.some((profile) => profile.mode === 'am')) return false;
  return bandIdForRxHz(channel.rxFrequency) === AIRBAND_BAND_ID;
}

/** Receive-only FM channel in broadcast band (87.5–108 MHz). */
export function isFmBroadcastBankChannel(channel: Channel): boolean {
  if (!isReceiveOnlyChannel(channel)) return false;
  if (!channel.modeProfiles.some((profile) => profile.mode === 'fm')) return false;
  return bandIdForRxHz(channel.rxFrequency) === FM_BROADCAST_BAND_ID;
}

export interface AnytoneChannelPartition {
  dmrChannels: AssembledChannel[];
  amAirChannels: AssembledChannel[];
  fmBroadcastChannels: AssembledChannel[];
}

export function partitionAnytoneChannels(assembled: AssembledBuild): AnytoneChannelPartition {
  const dmrChannels: AssembledChannel[] = [];
  const amAirChannels: AssembledChannel[] = [];
  const fmBroadcastChannels: AssembledChannel[] = [];

  for (const row of assembled.channels) {
    if (isAmAirbandBankChannel(row.entity)) {
      amAirChannels.push(row);
    } else if (isFmBroadcastBankChannel(row.entity)) {
      fmBroadcastChannels.push(row);
    } else {
      dmrChannels.push(row);
    }
  }

  return { dmrChannels, amAirChannels, fmBroadcastChannels };
}

export type AnytoneExportChannelBank = 'dmr' | 'amAir' | 'fmBroadcast';

/** Mirrors export bank partition — for UI grouping and docs. */
export function classifyAnytoneExportChannelBank(channel: Channel): AnytoneExportChannelBank {
  if (isAmAirbandBankChannel(channel)) return 'amAir';
  if (isFmBroadcastBankChannel(channel)) return 'fmBroadcast';
  return 'dmr';
}

/** @internal exported for tests — primary mode label when debugging partition misses. */
export function channelPartitionHint(channel: Channel): string {
  return `${primaryMode(channel) ?? 'none'} rx=${channel.rxFrequency ?? 'null'}`;
}
