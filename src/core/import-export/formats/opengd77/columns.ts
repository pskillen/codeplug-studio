/** OpenGD77 CPS CSV column headers — mirror docs/reference/opengd77/. */
export const CHANNEL_COL = {
  number: 'Channel Number',
  name: 'Channel Name',
  type: 'Channel Type',
  rx: 'Rx Frequency',
  tx: 'Tx Frequency',
  bandwidth: 'Bandwidth (kHz)',
  colourCode: 'Colour Code',
  timeslot: 'Timeslot',
  contact: 'Contact',
  tgList: 'TG List',
  dmrId: 'DMR ID',
  ts1TaTx: 'TS1_TA_Tx',
  ts2TaTxId: 'TS2_TA_Tx ID',
  rxTone: 'RX Tone',
  txTone: 'TX Tone',
  squelch: 'Squelch',
  power: 'Power',
  rxOnly: 'Rx Only',
  zoneSkip: 'Zone Skip',
  allSkip: 'All Skip',
  tot: 'TOT',
  vox: 'VOX',
  noBeep: 'No Beep',
  noEco: 'No Eco',
  aprs: 'APRS',
  lat: 'Latitude',
  lon: 'Longitude',
  useLocation: 'Use Location',
} as const;

export const CHANNEL_HEADERS: string[] = [
  CHANNEL_COL.number,
  CHANNEL_COL.name,
  CHANNEL_COL.type,
  CHANNEL_COL.rx,
  CHANNEL_COL.tx,
  CHANNEL_COL.bandwidth,
  CHANNEL_COL.colourCode,
  CHANNEL_COL.timeslot,
  CHANNEL_COL.contact,
  CHANNEL_COL.tgList,
  CHANNEL_COL.dmrId,
  CHANNEL_COL.ts1TaTx,
  CHANNEL_COL.ts2TaTxId,
  CHANNEL_COL.rxTone,
  CHANNEL_COL.txTone,
  CHANNEL_COL.squelch,
  CHANNEL_COL.power,
  CHANNEL_COL.rxOnly,
  CHANNEL_COL.zoneSkip,
  CHANNEL_COL.allSkip,
  CHANNEL_COL.tot,
  CHANNEL_COL.vox,
  CHANNEL_COL.noBeep,
  CHANNEL_COL.noEco,
  CHANNEL_COL.aprs,
  CHANNEL_COL.lat,
  CHANNEL_COL.lon,
  CHANNEL_COL.useLocation,
];

export const VENDOR_EXTRA_HEADERS = [
  CHANNEL_COL.zoneSkip,
  CHANNEL_COL.noBeep,
  CHANNEL_COL.noEco,
  CHANNEL_COL.ts1TaTx,
  CHANNEL_COL.ts2TaTxId,
] as const;

export function wireVoxEnabled(enabled: boolean): string {
  return enabled ? 'On' : 'Off';
}

export function wireYesNo(value: boolean): string {
  return value ? 'Yes' : 'No';
}

export const CONTACT_COL = {
  name: 'Contact Name',
  id: 'ID',
  idType: 'ID Type',
  tsOverride: 'TS Override',
} as const;

export const CONTACT_HEADERS = [
  CONTACT_COL.name,
  CONTACT_COL.id,
  CONTACT_COL.idType,
  CONTACT_COL.tsOverride,
];

export const RX_GROUP_LIST_COL = {
  name: 'TG List Name',
} as const;

export function rxGroupListMemberHeaders(count = 32): string[] {
  return Array.from({ length: count }, (_, i) => `Contact${i + 1}`);
}

export const RX_GROUP_LIST_HEADERS = [RX_GROUP_LIST_COL.name, ...rxGroupListMemberHeaders()];

export const DTMF_HEADERS = ['Contact Name', 'Code'];

export const APRS_HEADERS = [
  'APRS config Name',
  'SSID',
  'Via1',
  'Via1 SSID',
  'Via2',
  'Via2 SSID',
  'Icon table',
  'Icon',
  'Comment text',
  'Ambiguity',
  'Use position',
  'Latitude',
  'Longitude',
  'TX Frequency',
  'Transmit QSY',
  'Baud rate setting',
];

export function zoneMemberHeaders(count = 80): string[] {
  return Array.from({ length: count }, (_, i) => `Channel${i + 1}`);
}

export const ZONE_HEADERS = ['Zone Name', ...zoneMemberHeaders()];
