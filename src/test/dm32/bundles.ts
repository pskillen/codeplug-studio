import {
  CHANNEL_HEADERS,
  CONTACT_HEADERS,
  DTMF_CONTACT_HEADERS,
  RX_GROUP_LIST_HEADERS,
  TALKGROUP_HEADERS,
  ZONE_HEADERS,
} from '@core/import-export/formats/dm32/columns.ts';

/** Synthetic minimal DM32 export for strict export mapping tests. */
export const minimalDm32Bundle = {
  'Channels.csv': `${CHANNEL_HEADERS.join(',')}
1,GB7FE Stirling,Digital,439.47500,430.47500,High,12.5KHz,None,Channel Idle,None,1,Off,0,1,0,0,0,0,0,0,0,BM Scotland,Scotland,1,Slot 1,0,None,1,0,0,0,Paddy MM7IGV,None,None,None,Carrier/CTC,None,OFF,0,0
2,GB3FE Stirling,Fixed Digital,145.66250,145.06250,High,12.5KHz,None,Channel Idle,None,1,Off,0,1,0,0,0,0,0,0,0,BM Scotland,Scotland,1,Slot 1,0,None,1,0,0,0,Paddy MM7IGV,103.5,103.5,None,Carrier/CTC,None,OFF,0,0
3,GB7GL T1,Digital,430.85000,438.45000,High,12.5KHz,None,Channel Idle,None,1,Digital,0,1,0,0,0,0,0,0,0,None,ALL,7,Slot 1,0,None,1,0,0,0,Paddy MM7IGV,None,None,None,Carrier/CTC,None,OFF,0,0`,

  'Zones.csv': `${ZONE_HEADERS.join(',')}
1,North,GB7FE Stirling|GB3FE Stirling`,

  'Talkgroups.csv': `${TALKGROUP_HEADERS.join(',')}
1,BM Scotland,2355,Group Call
2,Local,9,Group Call`,

  'Contacts.csv': `${CONTACT_HEADERS.join(',')}
1,4000,,Disconnect,,,,,Private Call,0`,

  'RXGroupLists.csv': `${RX_GROUP_LIST_HEADERS.join(',')}
1,Scotland,BM Scotland|Local
2,ALL,BM Scotland|Local`,

  'DTMFContacts.csv': `${DTMF_CONTACT_HEADERS.join(',')}
1,AContact 1,96000`,
} as const;

export type Dm32FixtureBundle = Record<string, string>;
