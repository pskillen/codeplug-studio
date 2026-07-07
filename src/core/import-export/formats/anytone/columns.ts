/** Anytone CPS CSV column headers — shared by import and export adapters. */

import type { ImportFileKind } from '../../types.ts';

export const CHANNEL_COL = {
  number: 'No.',
  name: 'Channel Name',
  rx: 'Receive Frequency',
  tx: 'Transmit Frequency',
  channelType: 'Channel Type',
  power: 'Transmit Power',
  bandwidth: 'Band Width',
  rxTone: 'CTCSS/DCS Decode',
  txTone: 'CTCSS/DCS Encode',
  contactTalkGroup: 'Contact/Talk Group',
  contactCallType: 'Contact/Talk Group Call Type',
  contactTgId: 'Contact/Talk Group TG/DMR ID',
  radioId: 'Radio ID',
  colourCode: 'RX Color Code',
  slot: 'Slot',
  scanList: 'Scan List',
  rxGroupList: 'Receive Group List',
  pttProhibit: 'PTT Prohibit',
} as const;

export const CHANNEL_HEADERS: string[] = Object.values(CHANNEL_COL);

export const ZONE_COL = {
  number: 'No.',
  name: 'Zone Name',
  members: 'Zone Channel Member',
  memberRx: 'Zone Channel Member RX Frequency',
  memberTx: 'Zone Channel Member TX Frequency',
  aChannel: 'A Channel',
  aChannelRx: 'A Channel RX Frequency',
  aChannelTx: 'A Channel TX Frequency',
  bChannel: 'B Channel',
  bChannelRx: 'B Channel RX Frequency',
  bChannelTx: 'B Channel TX Frequency',
  zoneHide: 'Zone Hide ',
} as const;

export const ZONE_HEADERS: string[] = Object.values(ZONE_COL);

export const SCAN_LIST_COL = {
  number: 'No.',
  name: 'Scan List Name',
  members: 'Scan Channel Member',
  memberRx: 'Scan Channel Member RX Frequency',
  memberTx: 'Scan Channel Member TX Frequency',
  scanMode: 'Scan Mode',
  prioritySelect: 'Priority Channel Select',
  priority1: 'Priority Channel 1',
  priority1Rx: 'Priority Channel 1 RX Frequency',
  priority1Tx: 'Priority Channel 1 TX Frequency',
  priority2: 'Priority Channel 2',
  priority2Rx: 'Priority Channel 2 RX Frequency',
  priority2Tx: 'Priority Channel 2 TX Frequency',
  revertChannel: 'Revert Channel',
  lookBackA: 'Look Back Time A[s]',
  lookBackB: 'Look Back Time B[s]',
  dropoutDelay: 'Dropout Delay Time[s]',
  dwellTime: 'Dwell Time[s]',
} as const;

export const SCAN_LIST_HEADERS: string[] = Object.values(SCAN_LIST_COL);

export const TALK_GROUP_COL = {
  number: 'No.',
  radioId: 'Radio ID',
  name: 'Name',
  callType: 'Call Type',
  callAlert: 'Call Alert',
} as const;

export const TALK_GROUP_HEADERS: string[] = Object.values(TALK_GROUP_COL);

export const DIGITAL_CONTACT_COL = {
  number: 'No.',
  callsign: 'Callsign',
  name: 'Name',
  callType: 'Call Type',
} as const;

export const DIGITAL_CONTACT_HEADERS: string[] = Object.values(DIGITAL_CONTACT_COL);

export const RX_GROUP_LIST_COL = {
  number: 'No.',
  name: 'Group Name',
  contacts: 'Contact',
  contactIds: 'Contact TG/DMR ID',
} as const;

export const RX_GROUP_LIST_HEADERS: string[] = Object.values(RX_GROUP_LIST_COL);

export const RADIO_ID_COL = {
  number: 'No.',
  radioId: 'Radio ID',
  name: 'Name',
} as const;

export const RADIO_ID_HEADERS: string[] = Object.values(RADIO_ID_COL);

/** DMR MVP export file names (AT-D890UV casing). */
export const ANYTONE_EXPORT_FILE_NAMES = [
  'Channel.CSV',
  'DMRZone.CSV',
  'ScanList.CSV',
  'DMRTalkGroups.CSV',
  'DMRDigitalContactList.CSV',
  'DMRReceiveGroupCallList.CSV',
  'RadioIDList.CSV',
] as const;

export type AnytoneExportFileName = (typeof ANYTONE_EXPORT_FILE_NAMES)[number];

function headersInclude(headers: string[], ...required: string[]): boolean {
  const set = new Set(headers.map((h) => h.trim()));
  return required.every((h) => set.has(h));
}

function fileNameIncludes(fileName: string, fragment: string): boolean {
  return fileName.toLowerCase().includes(fragment.toLowerCase());
}

/** Classify an uploaded file for Anytone batch import (Phase 7b). */
export function detectKind(fileName: string, headerRow: string[]): ImportFileKind {
  const headers = headerRow.map((h) => h.trim());

  if (
    headersInclude(headers, CHANNEL_COL.name, CHANNEL_COL.rx, CHANNEL_COL.channelType) &&
    !fileNameIncludes(fileName, 'DMRZone')
  ) {
    return 'channels';
  }

  if (
    headersInclude(headers, ZONE_COL.name, ZONE_COL.members) &&
    fileNameIncludes(fileName, 'DMRZone')
  ) {
    return 'zones';
  }

  if (headersInclude(headers, SCAN_LIST_COL.name)) {
    return 'scanLists';
  }

  if (
    headersInclude(headers, RX_GROUP_LIST_COL.name, RX_GROUP_LIST_COL.contacts) &&
    fileNameIncludes(fileName, 'DMRReceive')
  ) {
    return 'rxGroupLists';
  }

  if (
    headersInclude(headers, TALK_GROUP_COL.radioId, TALK_GROUP_COL.name, TALK_GROUP_COL.callType) &&
    !headersInclude(headers, DIGITAL_CONTACT_COL.callsign) &&
    fileNameIncludes(fileName, 'DMRTalk')
  ) {
    return 'talkGroups';
  }

  if (
    headersInclude(headers, DIGITAL_CONTACT_COL.callsign, DIGITAL_CONTACT_COL.callType) &&
    fileNameIncludes(fileName, 'DMRDigitalContact')
  ) {
    return 'contacts';
  }

  if (
    headersInclude(headers, RADIO_ID_COL.radioId, RADIO_ID_COL.name) &&
    headers.length <= 4 &&
    fileNameIncludes(fileName, 'RadioIDList')
  ) {
    return 'radioIds';
  }

  return 'unknown';
}
