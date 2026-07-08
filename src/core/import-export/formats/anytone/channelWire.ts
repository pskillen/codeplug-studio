import type { Channel, ChannelModeProfileDMR } from '@core/models/library.ts';
import type { AssembledBuild, AssembledChannel } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { CHANNEL_COL, CHANNEL_HEADERS } from './columns.ts';
import { CHANNEL_ROW_DEFAULTS } from './channelDefaults.ts';
import {
  formatAnytoneBandwidthKhz,
  formatAnytoneChannelType,
  formatAnytoneFrequencyMHz,
  formatAnytonePowerWire,
  formatAnytoneTimeslot,
  formatAnytoneToneWire,
  resolveEntityWireName,
  resolveRxGroupListWireName,
} from './wireFormat.ts';
import { DEFAULT_ANYTONE_PROFILE_ID, getAnytoneProfile } from './profiles.ts';

function dmrProfile(channel: Channel): ChannelModeProfileDMR | null {
  const profile = channel.modeProfiles.find(
    (row): row is ChannelModeProfileDMR => row.mode === 'dmr',
  );
  return profile ?? null;
}

function analogProfile(channel: Channel) {
  return channel.modeProfiles.find((row) => row.mode === 'fm' || row.mode === 'am') ?? null;
}

export function serialiseAnytoneChannelRow(
  row: AssembledChannel,
  assembled: AssembledBuild,
  profileId: string,
  slot: number,
  options?: CpsExportOptions,
): Record<string, string> {
  const channel = row.entity;
  const dmr = dmrProfile(channel);
  const analog = analogProfile(channel);
  const profile = getAnytoneProfile(options?.profileId ?? profileId ?? DEFAULT_ANYTONE_PROFILE_ID);
  const contact = resolveEntityWireName(assembled, dmr?.contactRef ?? null);

  const values: Record<string, string> = {
    ...CHANNEL_ROW_DEFAULTS,
    [CHANNEL_COL.number]: String(slot),
    [CHANNEL_COL.name]: row.wireName,
    [CHANNEL_COL.rx]: formatAnytoneFrequencyMHz(channel.rxFrequency),
    [CHANNEL_COL.tx]: formatAnytoneFrequencyMHz(channel.txFrequency),
    [CHANNEL_COL.channelType]: formatAnytoneChannelType(
      dmr?.mode ?? channel.modeProfiles[0]?.mode ?? 'dmr',
    ),
    [CHANNEL_COL.power]: formatAnytonePowerWire(profile.id, channel.power),
    [CHANNEL_COL.bandwidth]: formatAnytoneBandwidthKhz(
      analog && 'bandwidthKHz' in analog ? analog.bandwidthKHz : 12.5,
    ),
    [CHANNEL_COL.rxTone]: formatAnytoneToneWire(
      analog && 'rxTone' in analog ? analog.rxTone : undefined,
    ),
    [CHANNEL_COL.txTone]: formatAnytoneToneWire(
      analog && 'txTone' in analog ? analog.txTone : undefined,
    ),
    [CHANNEL_COL.contactTalkGroup]: contact.name,
    [CHANNEL_COL.contactCallType]: contact.callType,
    [CHANNEL_COL.contactTgId]: contact.digitalId,
    [CHANNEL_COL.radioId]: profile.defaultRadioIdLabel,
    [CHANNEL_COL.colourCode]: String(dmr?.colourCode ?? 1),
    [CHANNEL_COL.slot]: formatAnytoneTimeslot(dmr?.timeslot ?? null),
    [CHANNEL_COL.scanList]: row.scanListWireName ?? 'None',
    [CHANNEL_COL.rxGroupList]: resolveRxGroupListWireName(assembled, dmr?.rxGroupListId),
    [CHANNEL_COL.pttProhibit]: channel.forbidTransmit ? 'On' : 'Off',
  };

  const rowValues: Record<string, string> = {};
  for (const header of CHANNEL_HEADERS) {
    rowValues[header] = values[header] ?? CHANNEL_ROW_DEFAULTS[header] ?? '';
  }
  return rowValues;
}
