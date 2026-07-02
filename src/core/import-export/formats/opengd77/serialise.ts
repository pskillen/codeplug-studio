import type { AssembledBuild } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type {
  Channel,
  ChannelModeProfile,
  ChannelModeProfileAnalog,
  ChannelModeProfileDMR,
} from '@core/models/library.ts';
import type { ChannelMode } from '@core/models/libraryTypes.ts';
import { expandChannelWireRows } from '@core/import-export/channelExpansion/multiMode.ts';
import { formatCsv } from './csvWrite.ts';
import {
  CHANNEL_COL,
  CHANNEL_HEADERS,
  CONTACT_COL,
  CONTACT_HEADERS,
  DTMF_HEADERS,
  APRS_HEADERS,
  RX_GROUP_LIST_COL,
  RX_GROUP_LIST_HEADERS,
  VENDOR_EXTRA_HEADERS,
  wireVoxEnabled,
  wireYesNo,
  ZONE_HEADERS,
  zoneMemberHeaders,
  rxGroupListMemberHeaders,
} from './columns.ts';
import { mapModeToOpenGd77ChannelType } from './channelModes.ts';
import {
  formatOpenGd77BandwidthWire,
  formatOpenGd77ColourCodeWire,
  formatOpenGd77DmrIdWire,
  formatOpenGd77FrequencyWire,
  formatOpenGd77PowerWire,
  formatOpenGd77SquelchWire,
  formatOpenGd77TimeslotWire,
  formatOpenGd77ToneWire,
  formatOpenGd77TransmitTimeoutWire,
} from './channelWire.ts';
import { contactRefWireName, rxGroupListWireName } from './exportRefs.ts';
import { rxGroupListExportMemberNames, zoneExportMemberNames } from './listWire.ts';
import {
  DEFAULT_OPENGD77_PROFILE_ID,
  getOpenGd77Profile,
  type OpenGd77RadioProfile,
} from './profiles.ts';

function padRow(headers: string[], values: Record<string, string>): string[] {
  return headers.map((h) => values[h] ?? '');
}

function isAnalogProfile(profile: ChannelModeProfile | null): profile is ChannelModeProfileAnalog {
  return (
    profile != null &&
    (profile.mode === 'fm' ||
      profile.mode === 'am' ||
      profile.mode === 'ssb-usb' ||
      profile.mode === 'ssb-lsb')
  );
}

function isDmrProfile(profile: ChannelModeProfile | null): profile is ChannelModeProfileDMR {
  return profile?.mode === 'dmr';
}

function channelRowValues(
  wireName: string,
  channel: Channel,
  mode: ChannelMode,
  modeProfile: ChannelModeProfile,
  assembled: AssembledBuild,
  profile: OpenGd77RadioProfile,
  rowNumber: number,
): Record<string, string> {
  const analog = isAnalogProfile(modeProfile) ? modeProfile : null;
  const dmr = isDmrProfile(modeProfile) ? modeProfile : null;

  const values: Record<string, string> = {
    [CHANNEL_COL.number]: String(rowNumber),
    [CHANNEL_COL.name]: wireName,
    [CHANNEL_COL.type]: mapModeToOpenGd77ChannelType(mode),
    [CHANNEL_COL.rx]: formatOpenGd77FrequencyWire(channel.rxFrequency),
    [CHANNEL_COL.tx]: formatOpenGd77FrequencyWire(channel.txFrequency),
    [CHANNEL_COL.bandwidth]: formatOpenGd77BandwidthWire(analog?.bandwidthKHz ?? null),
    [CHANNEL_COL.colourCode]: formatOpenGd77ColourCodeWire(dmr?.colourCode ?? null),
    [CHANNEL_COL.timeslot]: formatOpenGd77TimeslotWire(dmr?.timeslot ?? null),
    [CHANNEL_COL.contact]: contactRefWireName(assembled, dmr?.contactRef ?? null, mode),
    [CHANNEL_COL.tgList]: rxGroupListWireName(assembled, dmr?.rxGroupListId ?? null, mode),
    [CHANNEL_COL.dmrId]: formatOpenGd77DmrIdWire(mode, dmr?.dmrId ?? null),
    [CHANNEL_COL.rxTone]: formatOpenGd77ToneWire(mode, analog?.rxTone ?? null),
    [CHANNEL_COL.txTone]: formatOpenGd77ToneWire(mode, analog?.txTone ?? null),
    [CHANNEL_COL.squelch]: formatOpenGd77SquelchWire(mode, analog?.squelch ?? null),
    [CHANNEL_COL.power]: formatOpenGd77PowerWire(channel.power, profile.id),
    [CHANNEL_COL.rxOnly]: wireYesNo(false),
    [CHANNEL_COL.allSkip]: wireYesNo(channel.scanSkip),
    [CHANNEL_COL.tot]: formatOpenGd77TransmitTimeoutWire(null),
    [CHANNEL_COL.vox]: wireVoxEnabled(false),
    [CHANNEL_COL.aprs]: '',
    [CHANNEL_COL.lat]: channel.location ? String(channel.location.lat) : '',
    [CHANNEL_COL.lon]: channel.location ? String(channel.location.lon) : '',
    [CHANNEL_COL.useLocation]: wireYesNo(channel.useLocation),
  };

  for (const header of VENDOR_EXTRA_HEADERS) {
    values[header] = '';
  }

  return values;
}

export function serialiseChannels(assembled: AssembledBuild, options?: CpsExportOptions): string {
  const profile = getOpenGd77Profile(
    options?.profileId ?? assembled.profileId ?? DEFAULT_OPENGD77_PROFILE_ID,
  );
  const expandModes = options?.expandModes ?? true;
  const warnings: string[] = [];
  const reserved = new Set<string>();
  const expandedRows = assembled.channels.flatMap((row) =>
    expandChannelWireRows(
      row.entity,
      row.wireName,
      expandModes,
      options,
      profile.id,
      reserved,
      warnings,
    ),
  );
  const rows = expandedRows.map((row, i) =>
    padRow(
      CHANNEL_HEADERS,
      channelRowValues(
        row.wireName,
        assembled.channels.find((c) => c.entity.id === row.sourceChannelId)!.entity,
        row.mode,
        row.modeProfile,
        assembled,
        profile,
        i + 1,
      ),
    ),
  );
  return formatCsv(CHANNEL_HEADERS, rows);
}

export function serialiseZones(assembled: AssembledBuild, options?: CpsExportOptions): string {
  const profile = getOpenGd77Profile(
    options?.profileId ?? assembled.profileId ?? DEFAULT_OPENGD77_PROFILE_ID,
  );
  const memberHeaders = zoneMemberHeaders(profile.zoneMembers);
  const rows = assembled.zones.map((zone) => {
    const values: Record<string, string> = { 'Zone Name': zone.wireName };
    zoneExportMemberNames(zone, assembled, options).forEach((name, i) => {
      if (i < memberHeaders.length) values[memberHeaders[i]!] = name;
    });
    return padRow(ZONE_HEADERS, values);
  });
  return formatCsv(ZONE_HEADERS, rows);
}

export function serialiseContacts(assembled: AssembledBuild): string {
  const rows: string[][] = [];

  for (const tg of assembled.talkGroups) {
    rows.push(
      padRow(CONTACT_HEADERS, {
        [CONTACT_COL.name]: tg.wireName,
        [CONTACT_COL.id]: String(tg.entity.digitalId),
        [CONTACT_COL.idType]: 'Group',
        [CONTACT_COL.tsOverride]: '',
      }),
    );
  }

  for (const contact of assembled.digitalContacts) {
    rows.push(
      padRow(CONTACT_HEADERS, {
        [CONTACT_COL.name]: contact.wireName,
        [CONTACT_COL.id]: String(contact.entity.digitalId),
        [CONTACT_COL.idType]: 'Private',
        [CONTACT_COL.tsOverride]: '',
      }),
    );
  }

  for (const contact of assembled.analogContacts) {
    rows.push(
      padRow(CONTACT_HEADERS, {
        [CONTACT_COL.name]: contact.wireName,
        [CONTACT_COL.id]: contact.entity.code,
        [CONTACT_COL.idType]: 'Private',
        [CONTACT_COL.tsOverride]: '',
      }),
    );
  }

  return formatCsv(CONTACT_HEADERS, rows);
}

export function serialiseRxGroupLists(assembled: AssembledBuild, profileId?: string): string {
  const profile = getOpenGd77Profile(
    profileId ?? assembled.profileId ?? DEFAULT_OPENGD77_PROFILE_ID,
  );
  const memberHeaders = rxGroupListMemberHeaders(profile.tgListMembers);
  const rows = assembled.rxGroupLists.map((list) => {
    const values: Record<string, string> = { [RX_GROUP_LIST_COL.name]: list.wireName };
    rxGroupListExportMemberNames(assembled, list.entity.id).forEach((name, i) => {
      if (i < memberHeaders.length) values[memberHeaders[i]!] = name;
    });
    return padRow(RX_GROUP_LIST_HEADERS, values);
  });
  return formatCsv(RX_GROUP_LIST_HEADERS, rows);
}

export function serialiseDtmfHeaderOnly(): string {
  return formatCsv(DTMF_HEADERS, []);
}

export function serialiseAprsHeaderOnly(): string {
  return formatCsv(APRS_HEADERS, []);
}

export type OpenGd77ExportFileName =
  'Channels.csv' | 'Zones.csv' | 'Contacts.csv' | 'TG_Lists.csv' | 'DTMF.csv' | 'APRS.csv';

export type OpenGd77ExportFiles = Record<OpenGd77ExportFileName, string>;

export function serialiseOpenGd77Files(
  assembled: AssembledBuild,
  options?: CpsExportOptions,
): OpenGd77ExportFiles {
  const profileId = options?.profileId ?? assembled.profileId ?? DEFAULT_OPENGD77_PROFILE_ID;
  return {
    'Channels.csv': serialiseChannels(assembled, options),
    'Zones.csv': serialiseZones(assembled, options),
    'Contacts.csv': serialiseContacts(assembled),
    'TG_Lists.csv': serialiseRxGroupLists(assembled, profileId),
    'DTMF.csv': serialiseDtmfHeaderOnly(),
    'APRS.csv': serialiseAprsHeaderOnly(),
  };
}
