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
  busyLockTxPermit: 'Busy Lock/TX Permit',
  colourCode: 'RX Color Code',
  slot: 'Slot',
  scanList: 'Scan List',
  rxGroupList: 'Receive Group List',
  pttProhibit: 'PTT Prohibit',
  dmrMode: 'DMR MODE',
  autoScan: 'Auto Scan',
  aprsRx: 'APRS RX',
  analogAprsPtt: 'Analog APRS PTT Mode',
  digitalAprsPtt: 'Digital APRS PTT Mode',
  aprsReportType: 'APRS Report Type',
  digitalAprsReportChannel: 'Digital APRS Report Channel',
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

export const APRS_COL = {
  manualTxIntervalSec: 'Manual TX Interval[s]',
  autoTxIntervalSec: 'APRS Auto TX Interval[s]',
  supportForRoaming: 'Support For Roaming',
  fixedLocationBeacon: 'Fixed Location Beacon',
  latiDegree: 'LatiDegree',
  latiMinInt: 'LatiMinInt',
  latiMinMark: 'LatiMinMark',
  northOrSouth: 'North or South',
  longtiDegree: 'LongtiDegree',
  longtiMinInt: 'LongtiMinInt',
  longtiMinMark: 'LongtiMinMark',
  eastOrWest: 'East or West Hemisphere',
  aprsTg: 'APRS TG',
  callType: 'Call Type',
  channel1: 'channel1',
  slot1: 'slot1',
  aprsTg1: 'Aprs Tg1',
  callType1: 'Call Type1',
  channel2: 'channel2',
  slot2: 'slot2',
  aprsTg2: 'Aprs Tg2',
  callType2: 'Call Type2',
  channel3: 'channel3',
  slot3: 'slot3',
  aprsTg3: 'Aprs Tg3',
  callType3: 'Call Type3',
  channel4: 'channel4',
  slot4: 'slot4',
  aprsTg4: 'Aprs Tg4',
  callType4: 'Call Type4',
  channel5: 'channel5',
  slot5: 'slot5',
  aprsTg5: 'Aprs Tg5',
  callType5: 'Call Type5',
  channel6: 'channel6',
  slot6: 'slot6',
  aprsTg6: 'Aprs Tg6',
  callType6: 'Call Type6',
  channel7: 'channel7',
  slot7: 'slot7',
  aprsTg7: 'Aprs Tg7',
  callType7: 'Call Type7',
  channel8: 'channel8',
  slot8: 'slot8',
  aprsTg8: 'Aprs Tg8',
  callType8: 'Call Type8',
} as const;

/** Full APRS.CSV header row (AT-D890UV fixture). */
export const APRS_HEADERS: string[] = [
  'Manual TX Interval[s]',
  'APRS Auto TX Interval[s]',
  'Support For Roaming',
  'Fixed Location Beacon',
  'LatiDegree',
  'LatiMinInt',
  'LatiMinMark',
  'North or South',
  'LongtiDegree',
  'LongtiMinInt',
  'LongtiMinMark',
  'East or West Hemisphere',
  'channel1',
  'slot1',
  'Aprs Tg1',
  'Call Type1',
  'channel2',
  'slot2',
  'Aprs Tg2',
  'Call Type2',
  'channel3',
  'slot3',
  'Aprs Tg3',
  'Call Type3',
  'channel4',
  'slot4',
  'Aprs Tg4',
  'Call Type4',
  'channel5',
  'slot5',
  'Aprs Tg5',
  'Call Type5',
  'channel6',
  'slot6',
  'Aprs Tg6',
  'Call Type6',
  'channel7',
  'slot7',
  'Aprs Tg7',
  'Call Type7',
  'channel8',
  'slot8',
  'Aprs Tg8',
  'Call Type8',
  'APRS TG',
  'Call Type',
  'Repeater Activation Delay[ms]',
  'APRS TX Tone',
  'TOCALL',
  'TOCALL SSID',
  'Your Call Sign',
  'Your SSID',
  'APRS Symbol Table',
  'APRS Map Icon',
  'Digipeater Path',
  'Enter Your Sending Text',
  'Transmission Frequency [MHz]',
  'Transmit Delay[ms]',
  'Send Sub Tone',
  'CTCSS',
  'DCS',
  'Prewave Time[ms]',
  'Transmit Power',
  'Receive Filter1',
  'Call Sign1',
  'SSID1',
  'Receive Filter2',
  'Call Sign2',
  'SSID2',
  'Receive Filter3',
  'Call Sign3',
  'SSID3',
  'Receive Filter4',
  'Call Sign4',
  'SSID4',
  'Receive Filter5',
  'Call Sign5',
  'SSID5',
  'Receive Filter6',
  'Call Sign6',
  'SSID6',
  'Receive Filter7',
  'Call Sign7',
  'SSID7',
  'Receive Filter8',
  'Call Sign8',
  'SSID8',
  'Receive Filter9',
  'Call Sign9',
  'SSID9',
  'Receive Filter10',
  'Call Sign10',
  'SSID10',
  'Receive Filter11',
  'Call Sign11',
  'SSID11',
  'Receive Filter12',
  'Call Sign12',
  'SSID12',
  'Receive Filter13',
  'Call Sign13',
  'SSID13',
  'Receive Filter14',
  'Call Sign14',
  'SSID14',
  'Receive Filter15',
  'Call Sign15',
  'SSID15',
  'Receive Filter16',
  'Call Sign16',
  'SSID16',
  'Receive Filter17',
  'Call Sign17',
  'SSID17',
  'Receive Filter18',
  'Call Sign18',
  'SSID18',
  'Receive Filter19',
  'Call Sign19',
  'SSID19',
  'Receive Filter20',
  'Call Sign20',
  'SSID20',
  'Receive Filter21',
  'Call Sign21',
  'SSID21',
  'Receive Filter22',
  'Call Sign22',
  'SSID22',
  'Receive Filter23',
  'Call Sign23',
  'SSID23',
  'Receive Filter24',
  'Call Sign24',
  'SSID24',
  'Receive Filter25',
  'Call Sign25',
  'SSID25',
  'Receive Filter26',
  'Call Sign26',
  'SSID26',
  'Receive Filter27',
  'Call Sign27',
  'SSID27',
  'Receive Filter28',
  'Call Sign28',
  'SSID28',
  'Receive Filter29',
  'Call Sign29',
  'SSID29',
  'Receive Filter30',
  'Call Sign30',
  'SSID30',
  'Receive Filter31',
  'Call Sign31',
  'SSID31',
  'Receive Filter32',
  'Call Sign32',
  'SSID32',
  'POSITION',
  'MIC-E',
  'OBJECT',
  'ITEM',
  'MESSAGE',
  'WX REPORT',
  'NMEA REPORT',
  'STATUS REPORT',
  'OTHER',
  'Transmission Frequency"0',
  'Transmission Frequency"1',
  'Transmission Frequency"2',
  'Transmission Frequency"3',
  'Transmission Frequency"4',
  'Transmission Frequency"5',
  'Transmission Frequency"6',
  'Transmission Frequency"7',
];

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
  // RadioIDList.CSV omitted until radio IDs are modelled (#302) — placeholder rows clobber CPS.
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
