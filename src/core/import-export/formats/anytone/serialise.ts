import type { AssembledBuild } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import type { AnytoneExportFileName } from './columns.ts';
import {
  ANYTONE_EXPORT_FILE_NAMES,
  CHANNEL_HEADERS,
  DIGITAL_CONTACT_COL,
  DIGITAL_CONTACT_HEADERS,
  RADIO_ID_COL,
  RADIO_ID_HEADERS,
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
import { channelFrequencyById, rxGroupListMemberNames, wireNameByChannelId } from './listWire.ts';
import { DEFAULT_ANYTONE_PROFILE_ID, getAnytoneProfile } from './profiles.ts';

export type AnytoneExportFiles = Record<AnytoneExportFileName, string>;

function padRow(headers: string[], values: Record<string, string>): string[] {
  return headers.map((header) => values[header] ?? '');
}

function serialiseChannelsCsv(assembled: AssembledBuild, options?: CpsExportOptions): string {
  const profileId = options?.profileId ?? assembled.profileId ?? DEFAULT_ANYTONE_PROFILE_ID;
  const ordered = [...assembled.channels].sort((a, b) => {
    const slotA = a.orderOrSlot ?? Number.MAX_SAFE_INTEGER;
    const slotB = b.orderOrSlot ?? Number.MAX_SAFE_INTEGER;
    if (slotA !== slotB) return slotA - slotB;
    return a.wireName.localeCompare(b.wireName);
  });

  const rows = ordered.map((row, index) => {
    const slot = row.orderOrSlot ?? index + 1;
    return padRow(
      CHANNEL_HEADERS,
      serialiseAnytoneChannelRow(row, assembled, profileId, slot, options),
    );
  });
  return formatCsv(CHANNEL_HEADERS, rows);
}

function serialiseZonesCsv(assembled: AssembledBuild): string {
  const channels = channelFrequencyById(assembled);
  const wireNames = wireNameByChannelId(assembled);
  const rows = assembled.zones.map((zone, index) =>
    padRow(ZONE_HEADERS, {
      [ZONE_COL.number]: String(index + 1),
      [ZONE_COL.name]: zone.wireName,
      [ZONE_COL.members]: zone.memberChannelIds.map((id) => wireNames.get(id) ?? '').join('|'),
      [ZONE_COL.memberRx]: zone.memberChannelIds
        .map((id) => channels.get(id)?.rx ?? '0.00000')
        .join('|'),
      [ZONE_COL.memberTx]: zone.memberChannelIds
        .map((id) => channels.get(id)?.tx ?? '0.00000')
        .join('|'),
      [ZONE_COL.aChannel]: zone.memberChannelIds[0]
        ? (wireNames.get(zone.memberChannelIds[0]!) ?? '')
        : '',
      [ZONE_COL.aChannelRx]: zone.memberChannelIds[0]
        ? (channels.get(zone.memberChannelIds[0]!)?.rx ?? '')
        : '',
      [ZONE_COL.aChannelTx]: zone.memberChannelIds[0]
        ? (channels.get(zone.memberChannelIds[0]!)?.tx ?? '')
        : '',
      [ZONE_COL.bChannel]: zone.memberChannelIds[1]
        ? (wireNames.get(zone.memberChannelIds[1]!) ?? '')
        : '',
      [ZONE_COL.bChannelRx]: zone.memberChannelIds[1]
        ? (channels.get(zone.memberChannelIds[1]!)?.rx ?? '')
        : '',
      [ZONE_COL.bChannelTx]: zone.memberChannelIds[1]
        ? (channels.get(zone.memberChannelIds[1]!)?.tx ?? '')
        : '',
      [ZONE_COL.zoneHide]: '0',
    }),
  );
  return formatCsv(ZONE_HEADERS, rows);
}

function serialiseScanListsCsv(assembled: AssembledBuild): string {
  const channels = channelFrequencyById(assembled);
  const wireNames = wireNameByChannelId(assembled);
  const rows = assembled.scanLists.map((scanList, index) =>
    padRow(SCAN_LIST_HEADERS, {
      [SCAN_LIST_COL.number]: String(index + 1),
      [SCAN_LIST_COL.name]: scanList.wireName,
      [SCAN_LIST_COL.members]: scanList.memberChannelIds
        .map((id) => wireNames.get(id) ?? '')
        .join('|'),
      [SCAN_LIST_COL.memberRx]: scanList.memberChannelIds
        .map((id) => channels.get(id)?.rx ?? '0.00000')
        .join('|'),
      [SCAN_LIST_COL.memberTx]: scanList.memberChannelIds
        .map((id) => channels.get(id)?.tx ?? '0.00000')
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

function serialiseTalkGroupsCsv(assembled: AssembledBuild): string {
  const rows = assembled.talkGroups.map((tg, index) =>
    padRow(TALK_GROUP_HEADERS, {
      [TALK_GROUP_COL.number]: String(index + 1),
      [TALK_GROUP_COL.radioId]: String(tg.entity.digitalId),
      [TALK_GROUP_COL.name]: tg.wireName,
      [TALK_GROUP_COL.callType]: 'Group Call',
      [TALK_GROUP_COL.callAlert]: 'None',
    }),
  );
  return formatCsv(TALK_GROUP_HEADERS, rows);
}

function serialiseDigitalContactsCsv(assembled: AssembledBuild): string {
  const rows = assembled.digitalContacts.map((contact, index) =>
    padRow(DIGITAL_CONTACT_HEADERS, {
      [DIGITAL_CONTACT_COL.number]: String(index + 1),
      [DIGITAL_CONTACT_COL.callsign]: contact.entity.callsign ?? '',
      [DIGITAL_CONTACT_COL.name]: contact.wireName,
      [DIGITAL_CONTACT_COL.callType]: 'Private Call',
    }),
  );
  return formatCsv(DIGITAL_CONTACT_HEADERS, rows);
}

function serialiseRxGroupListsCsv(assembled: AssembledBuild): string {
  const rows = assembled.rxGroupLists.map((list, index) => {
    const members = rxGroupListMemberNames(assembled, list.entity.id);
    return padRow(RX_GROUP_LIST_HEADERS, {
      [RX_GROUP_LIST_COL.number]: String(index + 1),
      [RX_GROUP_LIST_COL.name]: list.wireName,
      [RX_GROUP_LIST_COL.contacts]: members.names.join('|'),
      [RX_GROUP_LIST_COL.contactIds]: members.ids.join('|'),
    });
  });
  return formatCsv(RX_GROUP_LIST_HEADERS, rows);
}

function serialiseRadioIdsCsv(profileId: string): string {
  const profile = getAnytoneProfile(profileId);
  const rows = [
    padRow(RADIO_ID_HEADERS, {
      [RADIO_ID_COL.number]: '1',
      [RADIO_ID_COL.radioId]: profile.defaultRadioId,
      [RADIO_ID_COL.name]: profile.defaultRadioIdLabel,
    }),
  ];
  return formatCsv(RADIO_ID_HEADERS, rows);
}

export function serialiseAnytoneFiles(
  assembled: AssembledBuild,
  library: LibrarySlice,
  options?: CpsExportOptions,
  warnings: string[] = [],
): AnytoneExportFiles {
  void library;
  void warnings;
  const profileId = options?.profileId ?? assembled.profileId ?? DEFAULT_ANYTONE_PROFILE_ID;
  return {
    'Channel.CSV': serialiseChannelsCsv(assembled, options),
    'DMRZone.CSV': serialiseZonesCsv(assembled),
    'ScanList.CSV': serialiseScanListsCsv(assembled),
    'DMRTalkGroups.CSV': serialiseTalkGroupsCsv(assembled),
    'DMRDigitalContactList.CSV': serialiseDigitalContactsCsv(assembled),
    'DMRReceiveGroupCallList.CSV': serialiseRxGroupListsCsv(assembled),
    'RadioIDList.CSV': serialiseRadioIdsCsv(profileId),
  };
}

export function serialiseAnytoneFile(
  assembled: AssembledBuild,
  library: LibrarySlice,
  fileName: string,
  options?: CpsExportOptions,
  warnings: string[] = [],
): string {
  if (!ANYTONE_EXPORT_FILE_NAMES.includes(fileName as AnytoneExportFileName)) {
    throw new Error(`Unknown Anytone export file: ${fileName}`);
  }
  const files = serialiseAnytoneFiles(assembled, library, options, warnings);
  return files[fileName as AnytoneExportFileName];
}
