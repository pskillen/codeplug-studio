import type { AssembledBuild } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { withTalkGroupWireNameLimits } from '@core/import-export/channelExpansion/talkGroupWireNames.ts';
import { formatCsv } from './csvWrite.ts';
import {
  CHANNEL_HEADERS,
  CONTACT_COL,
  CONTACT_HEADERS,
  DTMF_CONTACT_COL,
  DTMF_CONTACT_HEADERS,
  DM32_EXPORT_FILE_NAMES,
  RX_GROUP_LIST_COL,
  RX_GROUP_LIST_HEADERS,
  TALKGROUP_COL,
  TALKGROUP_HEADERS,
  ZONE_COL,
  ZONE_HEADERS,
  type Dm32ExportFileName,
} from './columns.ts';
import {
  expandAllDm32ChannelsForExport,
  expandDm32ZoneMemberWireNames,
  dm32ChannelExpansionById,
} from './channelExpansion.ts';
import { serialiseDm32ChannelRow } from './channelWire.ts';
import { buildDm32TalkGroupWireNameMap, rxGroupListExportMemberNames } from './listWire.ts';
import { DEFAULT_DM32_PROFILE_ID } from './profiles.ts';

export type Dm32ExportFiles = Record<Dm32ExportFileName, string>;

function padRow(headers: string[], values: Record<string, string>): string[] {
  return headers.map((h) => values[h] ?? '');
}

export interface Dm32SerialiseContext {
  assembled: AssembledBuild;
  library: LibrarySlice;
  talkGroupWireNames: ReturnType<typeof buildDm32TalkGroupWireNameMap>;
  expansionByChannelId: ReturnType<typeof dm32ChannelExpansionById>;
  expandedChannels: ReturnType<typeof expandAllDm32ChannelsForExport>;
}

function buildSerialiseContext(
  assembled: AssembledBuild,
  library: LibrarySlice,
  options?: CpsExportOptions,
  warnings: string[] = [],
): Dm32SerialiseContext {
  const exportAssembled = withTalkGroupWireNameLimits(assembled, options, warnings);
  const talkGroupWireNames = buildDm32TalkGroupWireNameMap(exportAssembled, options, warnings);
  const expandedChannels = expandAllDm32ChannelsForExport(
    exportAssembled,
    library,
    options,
    warnings,
  );
  const expansionByChannelId = dm32ChannelExpansionById(expandedChannels);
  return {
    assembled: exportAssembled,
    library,
    talkGroupWireNames,
    expansionByChannelId,
    expandedChannels,
  };
}

export function serialiseChannels(
  assembled: AssembledBuild,
  library: LibrarySlice,
  options?: CpsExportOptions,
  warnings: string[] = [],
  scanListByWireName?: Map<string, string>,
): string {
  const profileId = options?.profileId ?? assembled.profileId ?? DEFAULT_DM32_PROFILE_ID;
  const ctx = buildSerialiseContext(assembled, library, options, warnings);
  const channelById = new Map(assembled.channels.map((row) => [row.entity.id, row.entity]));
  const rows = ctx.expandedChannels.map((row, i) => {
    const source = channelById.get(row.sourceChannelId);
    if (!source) throw new Error(`Missing source channel ${row.sourceChannelId}`);
    const scanList = scanListByWireName?.get(row.wireName) ?? 'None';
    return padRow(
      CHANNEL_HEADERS,
      serialiseDm32ChannelRow(
        row,
        source,
        ctx.assembled,
        profileId,
        i + 1,
        ctx.talkGroupWireNames,
        options,
        scanList,
      ),
    );
  });
  return formatCsv(CHANNEL_HEADERS, rows);
}

export function serialiseZones(
  assembled: AssembledBuild,
  library: LibrarySlice,
  options?: CpsExportOptions,
  warnings: string[] = [],
): string {
  const ctx = buildSerialiseContext(assembled, library, options, warnings);
  const rows = assembled.zones.map((zone, i) => {
    const memberNames = expandDm32ZoneMemberWireNames(
      zone.memberChannelIds,
      ctx.expansionByChannelId,
    );
    return padRow(ZONE_HEADERS, {
      [ZONE_COL.number]: String(i + 1),
      [ZONE_COL.name]: zone.wireName,
      [ZONE_COL.members]: memberNames.join('|'),
    });
  });
  return formatCsv(ZONE_HEADERS, rows);
}

export function serialiseTalkGroups(
  assembled: AssembledBuild,
  options?: CpsExportOptions,
  warnings: string[] = [],
): string {
  const talkGroupWireNames = buildDm32TalkGroupWireNameMap(
    withTalkGroupWireNameLimits(assembled, options, warnings),
    options,
    warnings,
  );
  const rows = assembled.talkGroups.map((tg, i) =>
    padRow(TALKGROUP_HEADERS, {
      [TALKGROUP_COL.number]: String(i + 1),
      [TALKGROUP_COL.name]: talkGroupWireNames.get(tg.entity.id) ?? tg.wireName,
      [TALKGROUP_COL.id]: String(tg.entity.digitalId),
      [TALKGROUP_COL.type]: 'Group Call',
    }),
  );
  return formatCsv(TALKGROUP_HEADERS, rows);
}

export function serialiseDmrContacts(assembled: AssembledBuild): string {
  const rows = assembled.digitalContacts.map((contact, i) =>
    padRow(CONTACT_HEADERS, {
      [CONTACT_COL.number]: String(i + 1),
      [CONTACT_COL.id]: String(contact.entity.digitalId),
      [CONTACT_COL.repeater]: '',
      [CONTACT_COL.name]: contact.wireName,
      [CONTACT_COL.city]: '',
      [CONTACT_COL.province]: '',
      [CONTACT_COL.country]: '',
      [CONTACT_COL.remark]: '',
      [CONTACT_COL.type]: 'Private Call',
      [CONTACT_COL.alertCall]: '0',
    }),
  );
  return formatCsv(CONTACT_HEADERS, rows);
}

export function serialiseDtmfContacts(assembled: AssembledBuild): string {
  const rows = assembled.analogContacts.map((contact, i) =>
    padRow(DTMF_CONTACT_HEADERS, {
      [DTMF_CONTACT_COL.number]: String(i + 1),
      [DTMF_CONTACT_COL.name]: contact.wireName,
      [DTMF_CONTACT_COL.id]: contact.entity.code,
    }),
  );
  return formatCsv(DTMF_CONTACT_HEADERS, rows);
}

export function serialiseRxGroupLists(
  assembled: AssembledBuild,
  options?: CpsExportOptions,
  warnings: string[] = [],
): string {
  const exportAssembled = withTalkGroupWireNameLimits(assembled, options, warnings);
  const talkGroupWireNames = buildDm32TalkGroupWireNameMap(exportAssembled, options, warnings);
  const rows = assembled.rxGroupLists.map((list, i) =>
    padRow(RX_GROUP_LIST_HEADERS, {
      [RX_GROUP_LIST_COL.number]: String(i + 1),
      [RX_GROUP_LIST_COL.name]: list.wireName,
      [RX_GROUP_LIST_COL.members]: rxGroupListExportMemberNames(
        exportAssembled,
        list.entity.id,
        talkGroupWireNames,
      ).join('|'),
    }),
  );
  return formatCsv(RX_GROUP_LIST_HEADERS, rows);
}

export function serialiseDm32Files(
  assembled: AssembledBuild,
  library: LibrarySlice,
  options?: CpsExportOptions,
  warnings: string[] = [],
  scanListByWireName?: Map<string, string>,
): Dm32ExportFiles {
  const ctxWarnings = warnings;
  const exportAssembled = withTalkGroupWireNameLimits(assembled, options, ctxWarnings);
  const talkGroupWireNames = buildDm32TalkGroupWireNameMap(exportAssembled, options, ctxWarnings);
  const expandedChannels = expandAllDm32ChannelsForExport(
    exportAssembled,
    library,
    options,
    ctxWarnings,
  );
  const expansionByChannelId = dm32ChannelExpansionById(expandedChannels);

  const channelById = new Map(exportAssembled.channels.map((row) => [row.entity.id, row.entity]));
  const profileId = options?.profileId ?? exportAssembled.profileId ?? DEFAULT_DM32_PROFILE_ID;

  const channelRows = expandedChannels.map((row, i) => {
    const source = channelById.get(row.sourceChannelId);
    if (!source) throw new Error(`Missing source channel ${row.sourceChannelId}`);
    const scanList = scanListByWireName?.get(row.wireName) ?? 'None';
    return padRow(
      CHANNEL_HEADERS,
      serialiseDm32ChannelRow(
        row,
        source,
        exportAssembled,
        profileId,
        i + 1,
        talkGroupWireNames,
        options,
        scanList,
      ),
    );
  });

  const zoneRows = exportAssembled.zones.map((zone, i) => {
    const memberNames = expandDm32ZoneMemberWireNames(zone.memberChannelIds, expansionByChannelId);
    return padRow(ZONE_HEADERS, {
      [ZONE_COL.number]: String(i + 1),
      [ZONE_COL.name]: zone.wireName,
      [ZONE_COL.members]: memberNames.join('|'),
    });
  });

  return {
    'Channels.csv': formatCsv(CHANNEL_HEADERS, channelRows),
    'Zones.csv': formatCsv(ZONE_HEADERS, zoneRows),
    'Talkgroups.csv': serialiseTalkGroups(exportAssembled, options, ctxWarnings),
    'Contacts.csv': serialiseDmrContacts(exportAssembled),
    'RXGroupLists.csv': serialiseRxGroupLists(exportAssembled, options, ctxWarnings),
    'DTMFContacts.csv': serialiseDtmfContacts(exportAssembled),
  };
}

export { DM32_EXPORT_FILE_NAMES };
