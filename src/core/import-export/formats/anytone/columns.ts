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
  dmrMode: 'DMR MODE',
} as const;

/** Full Channel.CSV header row (AT-D890UV fixture). */
export const CHANNEL_HEADERS: string[] = [
  'No.',
  'Channel Name',
  'Receive Frequency',
  'Transmit Frequency',
  'Channel Type',
  'Transmit Power',
  'Band Width',
  'CTCSS/DCS Decode',
  'CTCSS/DCS Encode',
  'Contact/Talk Group',
  'Contact/Talk Group Call Type',
  'Contact/Talk Group TG/DMR ID',
  'Radio ID',
  'Busy Lock/TX Permit',
  'Squelch Mode',
  'Optional Signal',
  'DTMF ID',
  '2Tone ID',
  '5Tone ID',
  'PTT ID',
  'RX Color Code',
  'Slot',
  'Scan List',
  'Receive Group List',
  'PTT Prohibit',
  'Reverse',
  'Digital Duplex',
  'Slot Suit',
  'AES Digital Encryption',
  'Digital Encryption',
  'Call Confirmation',
  'Talk Around(Simplex)',
  'Work Alone',
  'Custom CTCSS',
  '2TONE Decode',
  'Ranging',
  'Idle TX',
  'APRS RX',
  'Analog APRS PTT Mode',
  'Digital APRS PTT Mode',
  'APRS Report Type',
  'Digital APRS Report Channel',
  'Correct Frequency[Hz]',
  'SMS Confirmation',
  'Exclude channel from roaming',
  'DMR MODE',
  'DataACK Disable',
  'R5toneBot',
  'R5ToneEot',
  'Auto Scan',
  'Ana APRS Mute',
  'Send Talker Alias DMR/NX',
  'AnaAprsTxPath',
  'ARC4',
  'ex_emg_kind',
  'Rpga_Mdc',
  'DisturEn',
  'DisturFreq',
  'dmr_crc_ignore',
  'compand',
  'tx_talkalaes',
  'dup_call',
  'tx_int',
  'BtRxState',
  'idle_tx',
  'nxdn_wn',
  'NxdnRpga',
  'nxdnSqCon',
  'NxdnTxBusy',
  'NxDnPttId',
  'EnRan',
  'DeRan',
  'NxdnEncry',
  'NxdnGroupId',
  'NxdnIdNum',
  'NxdnStateNum',
  'txcc',
];

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

export const AM_ZONE_COL = {
  number: 'No.',
  name: 'Zone Name',
  members: 'Zone Channel Member',
  aChannel: 'A Channel',
  scanChannel: 'Scan Channel ',
} as const;

export const AM_ZONE_HEADERS: string[] = Object.values(AM_ZONE_COL);

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
  radioId: 'Radio ID',
  callsign: 'Callsign',
  name: 'Name',
  city: 'City',
  state: 'State',
  country: 'Country',
  remarks: 'Remarks',
  callType: 'Call Type',
  callAlert: 'Call Alert',
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

export const AM_AIR_COL = {
  number: 'No.',
  frequencyMhz: 'Frequency[MHz]',
  name: 'Name',
} as const;

export const AM_AIR_HEADERS: string[] = Object.values(AM_AIR_COL);

export const FM_BROADCAST_COL = {
  number: 'No.',
  frequencyMhz: 'Frequency[MHz]',
  scan: 'Scan',
  name: 'Name',
} as const;

export const FM_BROADCAST_HEADERS: string[] = Object.values(FM_BROADCAST_COL);

/** VFO sentinel slots in receive-only banks (AT-D890UV fixtures). */
export const ANYTONE_AM_AIR_VFO_SLOT = 257;
export const ANYTONE_FM_BROADCAST_VFO_SLOT = 101;

/** Optional receive-bank files — included only when partition is non-empty. */
export const ANYTONE_RECEIVE_BANK_FILE_NAMES = ['AMAir.CSV', 'FM.CSV'] as const;

export type AnytoneReceiveBankFileName = (typeof ANYTONE_RECEIVE_BANK_FILE_NAMES)[number];

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
