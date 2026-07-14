import type { AssembledBuild } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import type { AnytoneExportFileName } from './columns.ts';
import {
  AM_AIR_COL,
  AM_AIR_HEADERS,
  AM_ZONE_COL,
  AM_ZONE_HEADERS,
  ANYTONE_AM_AIR_VFO_SLOT,
  ANYTONE_EXPORT_FILE_NAMES,
  ANYTONE_FM_BROADCAST_VFO_SLOT,
  CHANNEL_HEADERS,
  DIGITAL_CONTACT_COL,
  DIGITAL_CONTACT_HEADERS,
  FM_BROADCAST_COL,
  FM_BROADCAST_HEADERS,
  RX_GROUP_LIST_COL,
  RX_GROUP_LIST_HEADERS,
  SCAN_LIST_COL,
  SCAN_LIST_HEADERS,
  TALK_GROUP_COL,
  TALK_GROUP_HEADERS,
  ZONE_COL,
  ZONE_HEADERS,
} from './columns.ts';
import { formatCsv } from './csvWrite.ts';
import { serialiseAnytoneChannelRow } from './channelWire.ts';
import type { ChannelModeProfileDMR } from '@core/models/library.ts';
import {
  buildAnytoneExportWireContext,
  padReceiveBankName,
  type AnytoneExportWireContext,
} from './exportWireContext.ts';
import { expandAllAnytoneChannelsForExport } from './channelExpansion.ts';
import { channelFrequencyById, rxGroupListMemberNames } from './listWire.ts';
import { DEFAULT_ANYTONE_PROFILE_ID } from './profiles.ts';
import { partitionAnytoneChannels } from './receiveOnlyBanks.ts';
import { hasAmZoneExport, partitionAnytoneZones } from './zonePartition.ts';
import {
  buildScanContext,
  resolveEffectiveScanInclusion,
} from '@core/import-export/scanInclusion/resolve.ts';
import {
  prepareAnytoneExportAssembly,
  type AnytonePreparedExport,
} from './prepareExportAssembly.ts';
import {
  orderedDmrExpandedRows,
  orderedAmAirChannels,
  orderedFmBroadcastChannels,
  receiveBankChannelSlot,
} from './exportChannelSlots.ts';
import { hasAnytoneAprsExport, serialiseAprsCsv } from './exportAprsWire.ts';

export type AnytoneExportFiles = Record<AnytoneExportFileName, string>;

const AM_AIR_VFO_MHZ = '108.0000';
const FM_BROADCAST_VFO_MHZ = '88.000';

function anytoneExpansionLibrarySlice(assembled: AssembledBuild): LibrarySlice {
  return {
    channels: assembled.channels.map((row) => row.entity),
    zones: [],
    talkGroups: assembled.talkGroups.map((row) => row.entity),
    digitalContacts: assembled.digitalContacts.map((row) => row.entity),
    analogContacts: assembled.analogContacts.map((row) => row.entity),
    rxGroupLists: assembled.rxGroupLists.map((row) => row.entity),
    scanLists: [],
  };
}

function fallbackWireContext(
  assembled: AssembledBuild,
  options?: CpsExportOptions,
  warnings: string[] = [],
): AnytoneExportWireContext {
  const expandedChannels = expandAllAnytoneChannelsForExport(
    assembled,
    anytoneExpansionLibrarySlice(assembled),
    options,
    warnings,
  );
  return buildAnytoneExportWireContext(assembled, expandedChannels, options, warnings);
}

function formatAmAirMhz(rxHz: number): string {
  return (rxHz / 1_000_000).toFixed(4);
}

function formatFmBroadcastMhz(rxHz: number): string {
  return (rxHz / 1_000_000).toFixed(3);
}

function padRow(headers: string[], values: Record<string, string>): string[] {
  return headers.map((header) => values[header] ?? '');
}

function serialiseChannelsCsv(prepared: AnytonePreparedExport, options?: CpsExportOptions): string {
  const { assembled, context } = prepared;
  const profileId = options?.profileId ?? assembled.profileId ?? DEFAULT_ANYTONE_PROFILE_ID;
  const channelById = new Map(assembled.channels.map((row) => [row.entity.id, row]));
  const expandedRows = orderedDmrExpandedRows(assembled, prepared);

  const rows = expandedRows.map((expandedRow, index) => {
    const assembledChannel = channelById.get(expandedRow.sourceChannelId);
    if (!assembledChannel) return padRow(CHANNEL_HEADERS, {});
    const slot = assembledChannel.orderOrSlot ?? index + 1;
    const dmrProfile =
      expandedRow.modeProfile.mode === 'dmr'
        ? (expandedRow.modeProfile as ChannelModeProfileDMR)
        : null;
    return padRow(
      CHANNEL_HEADERS,
      serialiseAnytoneChannelRow(assembledChannel, assembled, profileId, slot, options, context, {
        wireName: expandedRow.wireName,
        txContactRef: expandedRow.txContactRef,
        rxGroupListId: expandedRow.rxGroupListId,
        dmrProfile,
      }),
    );
  });
  return formatCsv(CHANNEL_HEADERS, rows);
}

function serialiseZonesCsv(
  assembled: AssembledBuild,
  context: AnytoneExportWireContext,
  carrierPrependByZoneId?: Map<string, string>,
): string {
  const channels = channelFrequencyById(assembled);
  const { dmrZones } = partitionAnytoneZones(assembled);
  const rows = dmrZones.map((zone, index) => {
    const carrierChannelId = carrierPrependByZoneId?.has(zone.zoneId)
      ? `scan-carrier:${zone.zoneId}`
      : undefined;
    const carrierWireName = carrierChannelId
      ? context.channelWireName(carrierChannelId)
      : undefined;

    let memberNames = zone.memberChannelIds.flatMap((id) => context.memberChannelWireNames(id));
    let memberRx = zone.memberChannelIds.flatMap((id) => {
      const expanded = context.expansionByChannelId.get(id);
      const count = expanded?.length ?? 1;
      const freq = channels.get(id)?.rx ?? '0.00000';
      return Array.from({ length: count }, () => freq);
    });
    let memberTx = zone.memberChannelIds.flatMap((id) => {
      const expanded = context.expansionByChannelId.get(id);
      const count = expanded?.length ?? 1;
      const freq = channels.get(id)?.tx ?? '0.00000';
      return Array.from({ length: count }, () => freq);
    });

    if (carrierWireName && carrierChannelId) {
      memberNames = [carrierWireName, ...memberNames];
      memberRx = [channels.get(carrierChannelId)?.rx ?? '0.00000', ...memberRx];
      memberTx = [channels.get(carrierChannelId)?.tx ?? '0.00000', ...memberTx];
    }

    return padRow(ZONE_HEADERS, {
      [ZONE_COL.number]: String(index + 1),
      [ZONE_COL.name]: context.zoneWireName(zone.zoneId),
      [ZONE_COL.members]: memberNames.join('|'),
      [ZONE_COL.memberRx]: memberRx.join('|'),
      [ZONE_COL.memberTx]: memberTx.join('|'),
      [ZONE_COL.aChannel]: memberNames[0] ?? '',
      [ZONE_COL.aChannelRx]: memberRx[0] ?? '',
      [ZONE_COL.aChannelTx]: memberTx[0] ?? '',
      [ZONE_COL.bChannel]: memberNames[1] ?? '',
      [ZONE_COL.bChannelRx]: memberRx[1] ?? '',
      [ZONE_COL.bChannelTx]: memberTx[1] ?? '',
      [ZONE_COL.zoneHide]: '0',
    });
  });
  return formatCsv(ZONE_HEADERS, rows);
}

export function serialiseAmZonesCsv(
  assembled: AssembledBuild,
  options?: CpsExportOptions,
  warnings: string[] = [],
  context?: AnytoneExportWireContext,
): string {
  const ctx = context ?? fallbackWireContext(assembled, options, warnings);
  const { amZones } = partitionAnytoneZones(assembled);
  const rows = amZones.map((zone, index) => {
    const memberNames = zone.memberChannelIds.map((id) => ctx.receiveBankWireName(id).trim());
    const aChannel = memberNames[0] ?? '';
    return padRow(AM_ZONE_HEADERS, {
      [AM_ZONE_COL.number]: String(index + 1),
      [AM_ZONE_COL.name]: ctx.zoneWireName(zone.zoneId),
      [AM_ZONE_COL.members]: memberNames.join('|'),
      [AM_ZONE_COL.aChannel]: aChannel,
      [AM_ZONE_COL.scanChannel]: memberNames.join('|'),
    });
  });
  return formatCsv(AM_ZONE_HEADERS, rows);
}

function serialiseScanListsCsv(
  assembled: AssembledBuild,
  context: AnytoneExportWireContext,
): string {
  const channels = channelFrequencyById(assembled);
  const rows = assembled.scanLists.map((scanList, index) =>
    padRow(SCAN_LIST_HEADERS, {
      [SCAN_LIST_COL.number]: String(index + 1),
      [SCAN_LIST_COL.name]: context.scanListWireName(scanList.scanListId),
      [SCAN_LIST_COL.members]: scanList.memberChannelIds
        .flatMap((id) => context.memberChannelWireNames(id))
        .join('|'),
      [SCAN_LIST_COL.memberRx]: scanList.memberChannelIds
        .flatMap((id) => {
          const expanded = context.expansionByChannelId.get(id);
          const count = expanded?.length ?? 1;
          const freq = channels.get(id)?.rx ?? '0.00000';
          return Array.from({ length: count }, () => freq);
        })
        .join('|'),
      [SCAN_LIST_COL.memberTx]: scanList.memberChannelIds
        .flatMap((id) => {
          const expanded = context.expansionByChannelId.get(id);
          const count = expanded?.length ?? 1;
          const freq = channels.get(id)?.tx ?? '0.00000';
          return Array.from({ length: count }, () => freq);
        })
        .join('|'),
      [SCAN_LIST_COL.scanMode]: 'Off',
      [SCAN_LIST_COL.prioritySelect]: 'Off',
      [SCAN_LIST_COL.priority1]: 'Off',
      [SCAN_LIST_COL.priority1Rx]: '',
      [SCAN_LIST_COL.priority1Tx]: '',
      [SCAN_LIST_COL.priority2]: 'Off',
      [SCAN_LIST_COL.priority2Rx]: '',
      [SCAN_LIST_COL.priority2Tx]: '',
      [SCAN_LIST_COL.revertChannel]: 'Selected + TalkBack',
      [SCAN_LIST_COL.lookBackA]: '2.0',
      [SCAN_LIST_COL.lookBackB]: '3.0',
      [SCAN_LIST_COL.dropoutDelay]: '3.1',
      [SCAN_LIST_COL.dwellTime]: '1.0',
    }),
  );
  return formatCsv(SCAN_LIST_HEADERS, rows);
}

function serialiseTalkGroupsCsv(
  assembled: AssembledBuild,
  context: AnytoneExportWireContext,
): string {
  const rows = assembled.talkGroups.map((tg, index) =>
    padRow(TALK_GROUP_HEADERS, {
      [TALK_GROUP_COL.number]: String(index + 1),
      [TALK_GROUP_COL.radioId]: String(tg.entity.digitalId),
      [TALK_GROUP_COL.name]: context.talkGroupWireName(tg.entity.id),
      [TALK_GROUP_COL.callType]: 'Group Call',
      [TALK_GROUP_COL.callAlert]: 'None',
    }),
  );
  return formatCsv(TALK_GROUP_HEADERS, rows);
}

function serialiseDigitalContactsCsv(
  assembled: AssembledBuild,
  context: AnytoneExportWireContext,
): string {
  const rows = assembled.digitalContacts.map((contact, index) =>
    padRow(DIGITAL_CONTACT_HEADERS, {
      [DIGITAL_CONTACT_COL.number]: String(index + 1),
      [DIGITAL_CONTACT_COL.radioId]: String(contact.entity.digitalId),
      [DIGITAL_CONTACT_COL.callsign]: contact.entity.callsign,
      [DIGITAL_CONTACT_COL.name]: context.digitalContactWireName(contact.entity.id),
      [DIGITAL_CONTACT_COL.city]: contact.entity.city,
      [DIGITAL_CONTACT_COL.state]: contact.entity.state,
      [DIGITAL_CONTACT_COL.country]: contact.entity.country,
      [DIGITAL_CONTACT_COL.remarks]: contact.entity.remarks,
      [DIGITAL_CONTACT_COL.callType]: 'Private Call',
      [DIGITAL_CONTACT_COL.callAlert]: 'None',
    }),
  );
  return formatCsv(DIGITAL_CONTACT_HEADERS, rows);
}

function serialiseRxGroupListsCsv(
  assembled: AssembledBuild,
  context: AnytoneExportWireContext,
): string {
  const rows = assembled.rxGroupLists.map((list, index) => {
    const members = rxGroupListMemberNames(assembled, list.entity.id, context);
    return padRow(RX_GROUP_LIST_HEADERS, {
      [RX_GROUP_LIST_COL.number]: String(index + 1),
      [RX_GROUP_LIST_COL.name]: context.rxGroupListWireName(list.entity.id),
      [RX_GROUP_LIST_COL.contacts]: members.names.join('|'),
      [RX_GROUP_LIST_COL.contactIds]: members.ids.join('|'),
    });
  });
  return formatCsv(RX_GROUP_LIST_HEADERS, rows);
}

export function serialiseAmAirCsv(
  assembled: AssembledBuild,
  options?: CpsExportOptions,
  warnings: string[] = [],
  context?: AnytoneExportWireContext,
): string {
  const ctx = context ?? fallbackWireContext(assembled, options, warnings);
  const ordered = orderedAmAirChannels(assembled);
  const rows: string[][] = ordered.map((row, index) => {
    const slot = receiveBankChannelSlot(row, index);
    const rxHz = row.entity.rxFrequency ?? 0;
    return padRow(AM_AIR_HEADERS, {
      [AM_AIR_COL.number]: String(slot),
      [AM_AIR_COL.frequencyMhz]: formatAmAirMhz(rxHz),
      [AM_AIR_COL.name]: ctx.receiveBankWireName(row.entity.id),
    });
  });

  rows.push(
    padRow(AM_AIR_HEADERS, {
      [AM_AIR_COL.number]: String(ANYTONE_AM_AIR_VFO_SLOT),
      [AM_AIR_COL.frequencyMhz]: AM_AIR_VFO_MHZ,
      [AM_AIR_COL.name]: padReceiveBankName('VFO'),
    }),
  );

  return formatCsv(AM_AIR_HEADERS, rows);
}

export function serialiseFmBroadcastCsv(
  assembled: AssembledBuild,
  options?: CpsExportOptions,
  warnings: string[] = [],
  context?: AnytoneExportWireContext,
): string {
  const ctx = context ?? fallbackWireContext(assembled, options, warnings);
  const formatDefaults =
    options?.defaultScanInclusion != null
      ? { defaultScanInclusion: options.defaultScanInclusion }
      : undefined;
  const scanContext = buildScanContext(undefined, formatDefaults);
  const ordered = orderedFmBroadcastChannels(assembled);
  const rows: string[][] = ordered.map((row, index) => {
    const slot = receiveBankChannelSlot(row, index);
    const rxHz = row.entity.rxFrequency ?? 0;
    const scan = resolveEffectiveScanInclusion(row.entity, scanContext) === 'skip' ? 'Del' : 'Add';
    return padRow(FM_BROADCAST_HEADERS, {
      [FM_BROADCAST_COL.number]: String(slot),
      [FM_BROADCAST_COL.frequencyMhz]: formatFmBroadcastMhz(rxHz),
      [FM_BROADCAST_COL.scan]: scan,
      [FM_BROADCAST_COL.name]: ctx.receiveBankWireName(row.entity.id),
    });
  });

  rows.push(
    padRow(FM_BROADCAST_HEADERS, {
      [FM_BROADCAST_COL.number]: String(ANYTONE_FM_BROADCAST_VFO_SLOT),
      [FM_BROADCAST_COL.frequencyMhz]: FM_BROADCAST_VFO_MHZ,
      [FM_BROADCAST_COL.scan]: 'Del',
      [FM_BROADCAST_COL.name]: padReceiveBankName('VFO'),
    }),
  );

  return formatCsv(FM_BROADCAST_HEADERS, rows);
}

export function serialiseAnytoneFiles(
  assembled: AssembledBuild,
  library: LibrarySlice,
  options?: CpsExportOptions,
  warnings: string[] = [],
  prepared?: AnytonePreparedExport,
): AnytoneExportFiles {
  const exportPrep =
    prepared ?? prepareAnytoneExportAssembly(assembled, library, options, warnings);
  const exportAssembly = exportPrep.assembled;
  const ctx = exportPrep.context;
  return {
    'Channel.CSV': serialiseChannelsCsv(exportPrep, options),
    'DMRZone.CSV': serialiseZonesCsv(exportAssembly, ctx, exportPrep.carrierPrependByZoneId),
    'ScanList.CSV': serialiseScanListsCsv(exportAssembly, ctx),
    'DMRTalkGroups.CSV': serialiseTalkGroupsCsv(exportAssembly, ctx),
    'DMRDigitalContactList.CSV': serialiseDigitalContactsCsv(exportAssembly, ctx),
    'DMRReceiveGroupCallList.CSV': serialiseRxGroupListsCsv(exportAssembly, ctx),
  };
}

export function serialiseAnytoneFile(
  assembled: AssembledBuild,
  library: LibrarySlice,
  fileName: string,
  options?: CpsExportOptions,
  warnings: string[] = [],
): string {
  const prepared = prepareAnytoneExportAssembly(assembled, library, options, warnings);
  const { assembled: exportAssembly } = prepared;
  if (fileName === 'AMAir.CSV') {
    return serialiseAmAirCsv(exportAssembly, options, warnings, prepared.context);
  }
  if (fileName === 'FM.CSV') {
    return serialiseFmBroadcastCsv(exportAssembly, options, warnings, prepared.context);
  }
  if (fileName === 'AMZone.CSV') {
    return serialiseAmZonesCsv(exportAssembly, options, warnings, prepared.context);
  }
  if (fileName === 'APRS.CSV') {
    const config = exportAssembly.aprsConfiguration;
    if (!config) {
      throw new Error('APRS.CSV requested but no APRS configuration exists on assembled build');
    }
    return serialiseAprsCsv(config, exportAssembly, prepared, options, warnings);
  }
  if (!ANYTONE_EXPORT_FILE_NAMES.includes(fileName as AnytoneExportFileName)) {
    throw new Error(`Unknown Anytone export file: ${fileName}`);
  }
  const files = serialiseAnytoneFiles(exportAssembly, library, options, warnings, prepared);
  return files[fileName as AnytoneExportFileName];
}

export function resolveAnytoneExportFileNames(assembled: AssembledBuild): string[] {
  const partition = partitionAnytoneChannels(assembled);
  const names: string[] = [...ANYTONE_EXPORT_FILE_NAMES];
  if (partition.amAirChannels.length > 0) {
    names.push('AMAir.CSV');
  }
  if (partition.fmBroadcastChannels.length > 0) {
    names.push('FM.CSV');
  }
  if (hasAmZoneExport(assembled)) {
    names.push('AMZone.CSV');
  }
  if (hasAnytoneAprsExport(assembled)) {
    names.push('APRS.CSV');
  }
  return names;
}
