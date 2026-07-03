/** DM32 CPS CSV column headers — shared by import and export. */

export const CHANNEL_COL = {
  number: 'No.',
  name: 'Channel Name',
  type: 'Channel Type',
  rx: 'RX Frequency[MHz]',
  tx: 'TX Frequency[MHz]',
  power: 'Power',
  bandwidth: 'Band Width',
  scanList: 'Scan List',
  txAdmit: 'TX Admit',
  emergencySystem: 'Emergency System',
  squelch: 'Squelch Level',
  aprsReportType: 'APRS Report Type',
  forbidTx: 'Forbid TX',
  aprsReceive: 'APRS Receive',
  forbidTalkaround: 'Forbid Talkaround',
  autoScan: 'Auto Scan',
  loneWork: 'Lone Work',
  emergencyIndicator: 'Emergency Indicator',
  emergencyAck: 'Emergency ACK',
  analogAprsPtt: 'Analog APRS PTT Mode',
  digitalAprsPtt: 'Digital APRS PTT Mode',
  txContact: 'TX Contact',
  rxGroupList: 'RX Group List',
  colourCode: 'Color Code',
  timeslot: 'Time Slot',
  encryption: 'Encryption',
  encryptionId: 'Encryption ID',
  aprsReportChannel: 'APRS Report Channel',
  directDualMode: 'Direct Dual Mode',
  privateConfirm: 'Private Confirm',
  shortDataConfirm: 'Short Data Confirm',
  dmrIdLabel: 'DMR ID',
  rxTone: 'CTC/DCS Decode',
  txTone: 'CTC/DCS Encode',
  scramble: 'Scramble',
  rxSquelchMode: 'RX Squelch Mode',
  signalingType: 'Signaling Type',
  pttId: 'PTT ID',
  vox: 'VOX Function',
  pttIdDisplay: 'PTT ID Display',
} as const;

export const CHANNEL_HEADERS: string[] = Object.values(CHANNEL_COL);

export const ZONE_COL = {
  number: 'No.',
  name: 'Zone Name',
  members: 'Channel Members',
} as const;

export const ZONE_HEADERS: string[] = Object.values(ZONE_COL);

export const TALKGROUP_COL = {
  number: 'No.',
  name: 'Name',
  id: 'ID',
  type: 'Type',
} as const;

export const TALKGROUP_HEADERS: string[] = Object.values(TALKGROUP_COL);

export const CONTACT_COL = {
  number: 'No.',
  id: 'ID',
  repeater: 'Repeater',
  name: 'Name',
  city: 'City',
  province: 'Province',
  country: 'Country',
  remark: 'Remark',
  type: 'Type',
  alertCall: 'Alert Call',
} as const;

export const CONTACT_HEADERS: string[] = Object.values(CONTACT_COL);

export const DTMF_CONTACT_COL = {
  number: 'No.',
  name: 'Analog Contacts',
  id: 'ID',
} as const;

export const DTMF_CONTACT_HEADERS: string[] = Object.values(DTMF_CONTACT_COL);

export const RX_GROUP_LIST_COL = {
  number: 'No.',
  name: 'RX Group Name',
  members: 'Contact Members',
} as const;

export const RX_GROUP_LIST_HEADERS: string[] = Object.values(RX_GROUP_LIST_COL);

/** DM32 export file names (v1.60 PascalCase). */
export const DM32_EXPORT_FILE_NAMES = [
  'Channels.csv',
  'Zones.csv',
  'Talkgroups.csv',
  'Contacts.csv',
  'RXGroupLists.csv',
  'DTMFContacts.csv',
] as const;

export type Dm32ExportFileName = (typeof DM32_EXPORT_FILE_NAMES)[number];

export const DM32_NON_EXPANDABLE_RX_GROUP_LISTS = ['ALL'] as const;
