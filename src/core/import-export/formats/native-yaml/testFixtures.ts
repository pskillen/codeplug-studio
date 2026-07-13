import type { ProjectAggregate } from '../../projectDocument.ts';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import type {
  AnalogContact,
  Channel,
  DigitalContact,
  RxGroupList,
  TalkGroup,
  Zone,
} from '@core/models/library.ts';
import type { ProjectMeta } from '@core/models/project.ts';
import { initialRevision } from '@core/models/revision.ts';

export const FIXTURE_TIMESTAMP = '2026-07-02T10:00:00.000Z';
export const FIXTURE_PROJECT_ID = '11111111-1111-4111-8111-111111111111';
export const FIXTURE_CHANNEL_A_ID = '22222222-2222-4222-8222-222222222222';
export const FIXTURE_CHANNEL_B_ID = '33333333-3333-4333-8333-333333333333';
export const FIXTURE_ZONE_ID = '44444444-4444-4444-8444-444444444444';
export const FIXTURE_TG_ID = '55555555-5555-4555-8555-555555555555';
export const FIXTURE_DIGITAL_CONTACT_ID = '66666666-6666-4666-8666-666666666666';
export const FIXTURE_ANALOG_CONTACT_ID = '77777777-7777-4777-8777-777777777777';
export const FIXTURE_RX_LIST_ID = '88888888-8888-4888-8888-888888888888';
export const FIXTURE_BUILD_ID = '99999999-9999-4999-8999-999999999999';
export const FIXTURE_CHILD_ZONE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const FIXTURE_PARENT_ZONE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function rowMeta(projectId: string, id: string) {
  return {
    id,
    projectId,
    revision: initialRevision(),
    updatedAt: FIXTURE_TIMESTAMP,
  };
}

export function fixtureProjectMeta(): ProjectMeta {
  return {
    ...rowMeta(FIXTURE_PROJECT_ID, FIXTURE_PROJECT_ID),
    createdAt: FIXTURE_TIMESTAMP,
    name: 'Fixture project',
    description: 'Export golden fixture',
    notes: '',
    author: 'test',
  };
}

export function minimalProjectAggregate(): ProjectAggregate {
  const meta = fixtureProjectMeta();
  return {
    meta,
    channels: [],
    zones: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    scanLists: [],
    aprsConfigurations: [],
    formatBuilds: [],
  };
}

export function fullLibraryAggregate(): ProjectAggregate {
  const meta = fixtureProjectMeta();
  const projectId = FIXTURE_PROJECT_ID;

  const talkGroup: TalkGroup = {
    ...rowMeta(projectId, FIXTURE_TG_ID),
    mode: 'dmr',
    name: 'Scotland',
    digitalId: 950,
    comment: 'TG fixture',
    abbreviation: 'Sco',
  };

  const digitalContact: DigitalContact = {
    ...rowMeta(projectId, FIXTURE_DIGITAL_CONTACT_ID),
    mode: 'dmr',
    name: 'MM0HAM',
    digitalId: 1234567,
    comment: '',
  };

  const analogContact: AnalogContact = {
    ...rowMeta(projectId, FIXTURE_ANALOG_CONTACT_ID),
    name: 'EchoLink',
    code: '12345',
    comment: '',
  };

  const channelA: Channel = {
    ...rowMeta(projectId, FIXTURE_CHANNEL_A_ID),
    name: 'GB3DA Demo',
    callsign: 'GB3DA',
    rxFrequency: 430_912_500,
    txFrequency: 430_912_500,
    location: { lat: 55.9533, lon: -3.1883 },
    useLocation: true,
    maidenheadLocator: 'IO85vs',
    power: 25,
    scanInclusion: 'default',
    forbidTransmit: false,
    comment: 'Analog FM',
    primaryMode: null,
    scanListId: undefined,
    modeProfiles: [
      {
        mode: 'fm',
        squelch: 50,
        rxTone: '88.5',
        txTone: 'none',
        bandwidthKHz: 12.5,
      },
    ],
  };

  const channelB: Channel = {
    ...rowMeta(projectId, FIXTURE_CHANNEL_B_ID),
    name: 'DMR Scotland',
    callsign: 'GB7GL',
    rxFrequency: 439_087_500,
    txFrequency: 430_587_500,
    location: null,
    useLocation: false,
    maidenheadLocator: null,
    power: null,
    scanInclusion: 'skip',
    forbidTransmit: false,
    comment: '',
    primaryMode: null,
    scanListId: undefined,
    modeProfiles: [
      {
        mode: 'dmr',
        colourCode: 1,
        timeslot: 2,
        dmrId: 2351123,
        dmrMode: null,
        contactRef: { kind: 'digitalContact', id: FIXTURE_DIGITAL_CONTACT_ID },
        rxGroupListId: FIXTURE_RX_LIST_ID,
      },
    ],
  };

  const zone: Zone = {
    ...rowMeta(projectId, FIXTURE_ZONE_ID),
    name: 'Edinburgh',
    members: [{ kind: 'channel', channelId: FIXTURE_CHANNEL_A_ID }],
    comment: 'Zone fixture',
  };

  const rxGroupList: RxGroupList = {
    ...rowMeta(projectId, FIXTURE_RX_LIST_ID),
    name: 'Scotland TG list',
    members: [{ ref: { kind: 'talkGroup', id: FIXTURE_TG_ID }, timeSlotOverride: 2 }],
  };

  return {
    meta,
    channels: [channelA, channelB],
    zones: [zone],
    talkGroups: [talkGroup],
    digitalContacts: [digitalContact],
    analogContacts: [analogContact],
    rxGroupLists: [rxGroupList],
    scanLists: [],
    aprsConfigurations: [],
    formatBuilds: [],
  };
}

export function projectWithFormatBuildAggregate(): ProjectAggregate {
  const base = fullLibraryAggregate();
  const build: FormatBuild = {
    ...rowMeta(FIXTURE_PROJECT_ID, FIXTURE_BUILD_ID),
    formatId: 'opengd77',
    profileId: 'opengd77-1701',
    name: 'OpenGD77 1701',
    layout: {
      sections: [
        {
          kind: 'zoneGrouping',
          zones: [
            {
              id: FIXTURE_ZONE_ID,
              name: 'Edinburgh',
              channelIds: [FIXTURE_CHANNEL_A_ID, FIXTURE_CHANNEL_B_ID],
            },
          ],
        },
        {
          kind: 'flatMemory',
          channelIds: [FIXTURE_CHANNEL_B_ID, FIXTURE_CHANNEL_A_ID],
          scanFlags: {
            [FIXTURE_CHANNEL_A_ID]: false,
            [FIXTURE_CHANNEL_B_ID]: true,
          },
        },
      ],
    },
    channelOverrides: [
      {
        libraryEntityId: FIXTURE_CHANNEL_A_ID,
        wireName: 'GB3DA Demo',
      },
      {
        libraryEntityId: FIXTURE_CHANNEL_B_ID,
        wireName: 'GB7GL Scot',
      },
    ],
    zoneOverrides: [{ libraryEntityId: FIXTURE_ZONE_ID, wireName: 'Edinburgh' }],
    scanListOverrides: [],
    talkGroupOverrides: [{ libraryEntityId: FIXTURE_TG_ID, wireName: 'Scotland' }],
    rxGroupListOverrides: [{ libraryEntityId: FIXTURE_RX_LIST_ID, wireName: 'Scotland TG' }],
    contactOverrides: [{ libraryEntityId: FIXTURE_DIGITAL_CONTACT_ID, wireName: 'MM0HAM' }],
    exportUnlinkedChannels: true,
    exportUnlinkedTalkGroups: true,
    exportUnlinkedRxGroupLists: true,
  };

  return {
    ...base,
    formatBuilds: [build],
  };
}

export function nestedZonesAggregate(): ProjectAggregate {
  const base = fullLibraryAggregate();
  const projectId = FIXTURE_PROJECT_ID;
  const childZone: Zone = {
    ...rowMeta(projectId, FIXTURE_CHILD_ZONE_ID),
    name: 'Glasgow',
    members: [{ kind: 'channel', channelId: FIXTURE_CHANNEL_A_ID }],
    comment: '',
  };
  const parentZone: Zone = {
    ...rowMeta(projectId, FIXTURE_PARENT_ZONE_ID),
    name: 'Scotland',
    members: [
      { kind: 'zone', zoneId: FIXTURE_CHILD_ZONE_ID },
      { kind: 'channel', channelId: FIXTURE_CHANNEL_B_ID },
    ],
    comment: 'Nested fixture',
  };
  return {
    ...base,
    zones: [childZone, parentZone, ...base.zones],
  };
}

/** Glasgow nests PMR446; PMR446 is omitFromExport (nested-only building block). */
export function glasgowPmrNestedAggregate(): ProjectAggregate {
  const base = fullLibraryAggregate();
  const projectId = FIXTURE_PROJECT_ID;
  const pmrZone: Zone = {
    ...rowMeta(projectId, FIXTURE_CHILD_ZONE_ID),
    name: 'PMR446',
    omitFromExport: true,
    members: [{ kind: 'channel', channelId: FIXTURE_CHANNEL_A_ID }],
    comment: '',
  };
  const glasgowZone: Zone = {
    ...rowMeta(projectId, FIXTURE_PARENT_ZONE_ID),
    name: 'Glasgow',
    members: [
      { kind: 'channel', channelId: FIXTURE_CHANNEL_B_ID },
      { kind: 'zone', zoneId: FIXTURE_CHILD_ZONE_ID },
    ],
    comment: '',
  };
  return {
    ...base,
    zones: [pmrZone, glasgowZone],
    formatBuilds: [],
  };
}
