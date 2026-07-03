import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { Channel, RxGroupList, TalkGroup, Zone } from '@core/models/library.ts';
import {
  newAnalogContact,
  newChannel,
  newDigitalContact,
  newFormatBuild,
  newRxGroupList,
  newTalkGroup,
  newZone,
} from '@core/domain/factories.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';

const PROJECT_ID = 'proj-dm32-minimal';

export function minimalDm32ExportBuild(): FormatBuild {
  const build = newFormatBuild(PROJECT_ID, 'dm32-baofeng-dm32uv', 'DM32 minimal');
  return {
    ...build,
    contactOverrides: [{ libraryEntityId: 'dc-disconnect' }, { libraryEntityId: 'dtmf-1' }],
  };
}

/** Library slice that serialises to {@link minimalDm32Bundle}. */
export function minimalDm32ExportLibrary(): LibrarySlice {
  const tgBmScotland: TalkGroup = {
    ...newTalkGroup(PROJECT_ID, 'BM Scotland', 2355),
    id: 'tg-bm-scotland',
  };
  const tgLocal: TalkGroup = { ...newTalkGroup(PROJECT_ID, 'Local', 9), id: 'tg-local' };

  const rxScotland: RxGroupList = {
    ...newRxGroupList(PROJECT_ID, 'Scotland'),
    id: 'rgl-scotland',
    members: [
      { ref: { kind: 'talkGroup', id: tgBmScotland.id } },
      { ref: { kind: 'talkGroup', id: tgLocal.id } },
    ],
  };
  const rxAll: RxGroupList = {
    ...newRxGroupList(PROJECT_ID, 'ALL'),
    id: 'rgl-all',
    members: [
      { ref: { kind: 'talkGroup', id: tgBmScotland.id } },
      { ref: { kind: 'talkGroup', id: tgLocal.id } },
    ],
  };

  const chGb7fe: Channel = {
    ...newChannel(PROJECT_ID, 'GB7FE Stirling'),
    id: 'ch-gb7fe',
    rxFrequency: 439_475_000,
    txFrequency: 430_475_000,
    power: 100,
    modeProfiles: [
      {
        mode: 'dmr',
        colourCode: 1,
        timeslot: 1,
        dmrId: null,
        contactRef: { kind: 'talkGroup', id: tgBmScotland.id },
        rxGroupListId: rxScotland.id,
      },
    ],
  };

  const chGb3fe: Channel = {
    ...newChannel(PROJECT_ID, 'GB3FE Stirling'),
    id: 'ch-gb3fe',
    rxFrequency: 145_662_500,
    txFrequency: 145_062_500,
    power: 100,
    modeProfiles: [
      {
        mode: 'fm',
        squelch: 50,
        rxTone: '103.5',
        txTone: '103.5',
        bandwidthKHz: 12.5,
      },
      {
        mode: 'dmr',
        colourCode: 1,
        timeslot: 1,
        dmrId: null,
        contactRef: { kind: 'talkGroup', id: tgBmScotland.id },
        rxGroupListId: rxScotland.id,
      },
    ],
  };

  const chGb7glT1: Channel = {
    ...newChannel(PROJECT_ID, 'GB7GL T1'),
    id: 'ch-gb7gl-t1',
    rxFrequency: 430_850_000,
    txFrequency: 438_450_000,
    power: 100,
    modeProfiles: [
      {
        mode: 'dmr',
        colourCode: 7,
        timeslot: 1,
        dmrId: null,
        contactRef: null,
        rxGroupListId: rxAll.id,
      },
    ],
  };

  const zoneNorth: Zone = {
    ...newZone(PROJECT_ID, 'North'),
    id: 'zone-north',
    members: [{ channelId: chGb7fe.id }, { channelId: chGb3fe.id }],
  };

  const disconnect = { ...newDigitalContact(PROJECT_ID, 'Disconnect', 4000), id: 'dc-disconnect' };
  const dtmf = { ...newAnalogContact(PROJECT_ID, 'AContact 1', '96000'), id: 'dtmf-1' };

  return {
    channels: [chGb7fe, chGb3fe, chGb7glT1],
    zones: [zoneNorth],
    talkGroups: [tgBmScotland, tgLocal],
    digitalContacts: [disconnect],
    analogContacts: [dtmf],
    rxGroupLists: [rxScotland, rxAll],
  };
}
