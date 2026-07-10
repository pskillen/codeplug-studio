import type { Channel, ChannelModeProfileDMR } from '@core/models/library.ts';
import type { EntityRef } from '@core/models/libraryTypes.ts';
import type { AssembledBuild, AssembledChannel } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { CHANNEL_COL, CHANNEL_HEADERS } from './columns.ts';
import { CHANNEL_ROW_DEFAULTS } from './channelDefaults.ts';
import type { AnytoneExportWireContext } from './exportWireContext.ts';
import {
  formatAnytoneBandwidthKhz,
  formatAnytoneChannelTypeFromChannel,
  formatAnytoneDmrModeWire,
  formatAnytoneFrequencyMHz,
  formatAnytonePowerWire,
  formatAnytoneTimeslot,
  formatAnytoneToneWire,
  resolveEntityWireName,
  resolveRxGroupListWireName,
} from './wireFormat.ts';
import { isZoneScanCarrierChannelId } from '@core/import-export/zoneDerivedScanLists/carrier.ts';
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

function resolveContactWireName(
  assembled: AssembledBuild,
  context: AnytoneExportWireContext | undefined,
  ref: ChannelModeProfileDMR['contactRef'] | null | undefined,
): { name: string; callType: string; digitalId: string } {
  if (!ref) {
    return { name: '', callType: 'Group Call', digitalId: '' };
  }
  if (context) {
    if (ref.kind === 'talkGroup') {
      const tg = assembled.talkGroups.find((row) => row.entity.id === ref.id);
      return {
        name: context.talkGroupWireName(ref.id),
        callType: 'Group Call',
        digitalId: tg ? String(tg.entity.digitalId) : '',
      };
    }
    if (ref.kind === 'digitalContact') {
      const contact = assembled.digitalContacts.find((row) => row.entity.id === ref.id);
      return {
        name: context.digitalContactWireName(ref.id),
        callType: 'Private Call',
        digitalId: contact ? String(contact.entity.digitalId) : '',
      };
    }
    return { name: '', callType: 'Group Call', digitalId: '' };
  }
  return resolveEntityWireName(assembled, ref);
}

function resolveScanListWireName(
  channel: Channel,
  row: AssembledChannel,
  context: AnytoneExportWireContext | undefined,
): string {
  if (context && channel.scanListId) {
    const name = context.scanListWireName(channel.scanListId);
    return name || 'None';
  }
  return row.scanListWireName ?? 'None';
}

function resolveRxGroupListColumn(
  assembled: AssembledBuild,
  context: AnytoneExportWireContext | undefined,
  listId: string | null | undefined,
): string {
  if (!listId) return 'None';
  if (context) {
    const name = context.rxGroupListWireName(listId);
    return name || 'None';
  }
  return resolveRxGroupListWireName(assembled, listId);
}

export interface AnytoneExpandedChannelProjection {
  wireName: string;
  txContactRef: EntityRef | null;
  rxGroupListId: string | null;
  dmrProfile: ChannelModeProfileDMR | null;
}

export function serialiseAnytoneChannelRow(
  row: AssembledChannel,
  assembled: AssembledBuild,
  profileId: string,
  slot: number,
  options?: CpsExportOptions,
  contextOrWireName?: AnytoneExportWireContext | string,
  projection?: AnytoneExpandedChannelProjection,
): Record<string, string> {
  const channel = row.entity;
  const dmr = projection?.dmrProfile ?? dmrProfile(channel);
  const analog = analogProfile(channel);
  const profile = getAnytoneProfile(options?.profileId ?? profileId ?? DEFAULT_ANYTONE_PROFILE_ID);
  const context =
    typeof contextOrWireName === 'object' && contextOrWireName != null
      ? contextOrWireName
      : undefined;
  const wireNameOverride = typeof contextOrWireName === 'string' ? contextOrWireName : undefined;
  const contactRef =
    projection != null ? projection.txContactRef : (dmr?.contactRef ?? null);
  const contact = resolveContactWireName(assembled, context, contactRef);
  const rxGroupListId =
    projection != null ? projection.rxGroupListId : (dmr?.rxGroupListId ?? null);

  const values: Record<string, string> = {
    ...CHANNEL_ROW_DEFAULTS,
    [CHANNEL_COL.number]: String(slot),
    [CHANNEL_COL.name]:
      projection?.wireName ??
      context?.channelWireName(channel.id) ??
      wireNameOverride ??
      row.wireName,
    [CHANNEL_COL.rx]: formatAnytoneFrequencyMHz(channel.rxFrequency),
    [CHANNEL_COL.tx]: formatAnytoneFrequencyMHz(channel.txFrequency),
    [CHANNEL_COL.channelType]: formatAnytoneChannelTypeFromChannel(channel),
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
    [CHANNEL_COL.scanList]: resolveScanListWireName(channel, row, context),
    [CHANNEL_COL.rxGroupList]: resolveRxGroupListColumn(assembled, context, rxGroupListId),
    [CHANNEL_COL.pttProhibit]: channel.forbidTransmit ? 'On' : 'Off',
  };

  if (dmr) {
    values[CHANNEL_COL.dmrMode] = formatAnytoneDmrModeWire(channel);
  }

  if (isZoneScanCarrierChannelId(channel.id)) {
    values[CHANNEL_COL.autoScan] = '1';
  }

  const rowValues: Record<string, string> = {};
  for (const header of CHANNEL_HEADERS) {
    rowValues[header] = values[header] ?? CHANNEL_ROW_DEFAULTS[header] ?? '';
  }
  return rowValues;
}
