import { describe, expect, it } from 'vitest';
import type {
  Channel,
  ChannelModeProfileAnalog,
  ChannelModeProfileDMR,
} from '@core/models/library.ts';
import {
  newChannel,
  newDigitalContact,
  newFormatBuild,
  newRxGroupList,
  newScanList,
  newTalkGroup,
  newZone,
} from '@core/domain/factories.ts';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import { assemble } from '@core/services/assemble.ts';
import { csvToTable } from '@core/import-export/csvParse.ts';
import { serialiseAnytoneFiles } from './serialise.ts';
import { serialiseAnytoneChannelRow } from './channelWire.ts';
import { partitionAnytoneChannels } from './receiveOnlyBanks.ts';
import { buildChannelBehaviourContext } from '@core/import-export/channelBehaviourDefaults/resolve.ts';
import { DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS } from '@core/models/channelBehaviourDefaults.ts';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

describe('anytone serialise', () => {
  it('serialises DMR channel core columns', () => {
    const tg = newTalkGroup(PROJECT_ID, 'TG Alpha', 2355);
    const channel: Channel = {
      ...newChannel(PROJECT_ID, 'Channel 1'),
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
      power: 25,
      modeProfiles: [
        {
          mode: 'dmr' as const,
          colourCode: 1,
          timeslot: 2 as const,
          dmrId: 1234567,
          contactRef: { kind: 'talkGroup' as const, id: tg.id },
          rxGroupListId: null,
        },
      ],
    };

    const row = serialiseAnytoneChannelRow(
      { entity: channel, wireName: 'Channel 1', scanListWireName: 'Zone A SCL' },
      {
        buildId: 'b1',
        formatId: 'anytone',
        profileId: 'anytone-at-d890uv',
        buildName: 'Test',
        channels: [{ entity: channel, wireName: 'Channel 1' }],
        zones: [],
        scanLists: [],
        talkGroups: [{ entity: tg, wireName: 'TG Alpha' }],
        digitalContacts: [],
        analogContacts: [],
        rxGroupLists: [],
      },
      'anytone-at-d890uv',
      1,
    );

    expect(row['Channel Name']).toBe('Channel 1');
    expect(row['Receive Frequency']).toBe('438.80000');
    expect(row['Channel Type']).toBe('D-Digital');
    expect(row['Busy Lock/TX Permit']).toBe('Always');
    expect(row['Send Talker Alias DMR/NX']).toBe('1');
    expect(row.tx_talkalaes).toBe('1');
    expect(row['DMR MODE']).toBe('1');
    expect(row['Transmit Power']).toBe('Low');
    expect(row['Call Confirmation']).toBe('On');
    expect(row['SMS Confirmation']).toBe('On');
    expect(row['Contact/Talk Group']).toBe('TG Alpha');
    expect(row['Scan List']).toBe('Zone A SCL');
    expect(row['RX Color Code']).toBe('1');
    expect(row.txcc).toBe('1');
  });

  it('sets txcc equal to RX Color Code when library colour code is not 1', () => {
    const channel: Channel = {
      ...newChannel(PROJECT_ID, 'GB7GL'),
      rxFrequency: 439_487_500,
      txFrequency: 430_487_500,
      modeProfiles: [
        {
          mode: 'dmr' as const,
          colourCode: 7,
          timeslot: 1 as const,
          dmrId: 1234567,
          contactRef: null,
          rxGroupListId: null,
        },
      ],
    };

    const row = serialiseAnytoneChannelRow(
      { entity: channel, wireName: 'GB7GL' },
      {
        buildId: 'b1',
        formatId: 'anytone',
        profileId: 'anytone-at-d890uv',
        buildName: 'Test',
        channels: [{ entity: channel, wireName: 'GB7GL' }],
        zones: [],
        scanLists: [],
        talkGroups: [],
        digitalContacts: [],
        analogContacts: [],
        rxGroupLists: [],
      },
      'anytone-at-d890uv',
      1,
    );

    expect(row['RX Color Code']).toBe('7');
    expect(row.txcc).toBe('7');
  });

  it('serialises Transmit Power Mid and Turbo from percent', () => {
    const base: Channel = {
      ...newChannel(PROJECT_ID, 'Power Ch'),
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      modeProfiles: [defaultModeProfile('fm')],
    };
    const assembleCtx = {
      buildId: 'b1',
      formatId: 'anytone',
      profileId: 'anytone-at-d890uv',
      buildName: 'Test',
      channels: [{ entity: base, wireName: 'Power Ch' }],
      zones: [],
      scanLists: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
    };

    const mid = serialiseAnytoneChannelRow(
      { entity: { ...base, power: 50 }, wireName: 'Power Ch' },
      assembleCtx,
      'anytone-at-d890uv',
      1,
    );
    expect(mid['Transmit Power']).toBe('Mid');

    const turbo = serialiseAnytoneChannelRow(
      { entity: { ...base, power: 100 }, wireName: 'Power Ch' },
      assembleCtx,
      'anytone-at-d890uv',
      1,
    );
    expect(turbo['Transmit Power']).toBe('Turbo');

    const high = serialiseAnytoneChannelRow(
      { entity: { ...base, power: 75 }, wireName: 'Power Ch' },
      assembleCtx,
      'anytone-at-d890uv',
      1,
    );
    expect(high['Transmit Power']).toBe('High');
  });

  it('serialises Channel Free Busy Lock for FM channels', () => {
    const channel: Channel = {
      ...newChannel(PROJECT_ID, 'Analog 1'),
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      modeProfiles: [defaultModeProfile('fm')],
    };

    const row = serialiseAnytoneChannelRow(
      { entity: channel, wireName: 'Analog 1' },
      {
        buildId: 'b1',
        formatId: 'anytone',
        profileId: 'anytone-at-d890uv',
        buildName: 'Test',
        channels: [{ entity: channel, wireName: 'Analog 1' }],
        zones: [],
        scanLists: [],
        talkGroups: [],
        digitalContacts: [],
        analogContacts: [],
        rxGroupLists: [],
      },
      'anytone-at-d890uv',
      1,
    );

    expect(row['Channel Type']).toBe('A-Analog');
    expect(row['Busy Lock/TX Permit']).toBe('Off');
    expect(row['Squelch Mode']).toBe('Carrier');
  });

  it('serialises behavioural cascade for Busy Lock, Talker Alias, and Squelch Mode', () => {
    const dmrProfile: ChannelModeProfileDMR = {
      ...(defaultModeProfile('dmr') as ChannelModeProfileDMR),
      sendTalkerAlias: 'off',
    };
    const analogProfile: ChannelModeProfileAnalog = {
      ...(defaultModeProfile('fm') as ChannelModeProfileAnalog),
      analogSquelchMode: 'tone',
      rxTone: 'none',
    };
    const dmrChannel: Channel = {
      ...newChannel(PROJECT_ID, 'DMR Busy'),
      txPermit: 'busyLock',
      modeProfiles: [dmrProfile],
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
    };
    const analogChannel: Channel = {
      ...newChannel(PROJECT_ID, 'FM Tone'),
      txPermit: 'busyLock',
      modeProfiles: [analogProfile],
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
    };
    const assembleCtx = {
      buildId: 'b1',
      formatId: 'anytone',
      profileId: 'anytone-at-d890uv',
      buildName: 'Test',
      channels: [],
      zones: [],
      scanLists: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
    };

    const dmrRow = serialiseAnytoneChannelRow(
      { entity: dmrChannel, wireName: 'DMR Busy' },
      assembleCtx,
      'anytone-at-d890uv',
      1,
    );
    expect(dmrRow['Busy Lock/TX Permit']).toBe('ChannelFree');
    expect(dmrRow['Send Talker Alias DMR/NX']).toBe('0');
    expect(dmrRow.tx_talkalaes).toBe('0');

    const analogRow = serialiseAnytoneChannelRow(
      { entity: analogChannel, wireName: 'FM Tone' },
      assembleCtx,
      'anytone-at-d890uv',
      2,
    );
    expect(analogRow['Busy Lock/TX Permit']).toBe('Channel Free');
    expect(analogRow['Squelch Mode']).toBe('CTCSS/DCS');
  });

  it('routes library-default forbid channels to receive-only banks', () => {
    const tg = newTalkGroup(PROJECT_ID, 'TG Alpha', 2355);
    const dmr: Channel = {
      ...newChannel(PROJECT_ID, 'GB3AO'),
      rxFrequency: 430_975_000,
      txFrequency: 438_575_000,
      forbidTransmit: 'default',
      modeProfiles: [
        {
          mode: 'dmr' as const,
          colourCode: 1,
          timeslot: 1 as const,
          dmrId: 1234567,
          contactRef: { kind: 'talkGroup' as const, id: tg.id },
          rxGroupListId: null,
        },
      ],
    };
    const airband: Channel = {
      ...newChannel(PROJECT_ID, 'Aboyne Info'),
      rxFrequency: 118_665_000,
      txFrequency: 430_975_000,
      forbidTransmit: 'default',
      modeProfiles: [
        {
          mode: 'am' as const,
          squelch: null,
          rxTone: 'none' as const,
          txTone: 'none' as const,
          bandwidthKHz: 8.33,
        },
      ],
    };
    const zone = {
      ...newZone(PROJECT_ID, 'Aboyne'),
      members: [
        { kind: 'channel' as const, channelId: dmr.id },
        { kind: 'channel' as const, channelId: airband.id },
      ],
    };
    const build = {
      ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv'),
      layout: {
        sections: [
          {
            kind: 'zoneGrouping' as const,
            zones: [{ id: zone.id, name: zone.name, channelIds: [dmr.id, airband.id] }],
          },
        ],
      },
    };
    const library = {
      channels: [dmr, airband],
      zones: [zone],
      talkGroups: [tg],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
      channelDefaults: { ...DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS, forbidTransmit: true },
    };

    const assembled = assemble(build, library);
    const context = buildChannelBehaviourContext(library.channelDefaults);
    const partition = partitionAnytoneChannels(assembled, context);

    expect(partition.dmrChannels.map((row) => row.wireName)).toContain('GB3AO');
    expect(partition.amAirChannels.map((row) => row.wireName)).toContain('Aboyne Info');
  });

  it('serialises Squelch Mode CTCSS/DCS when analog squelch mode is tone', () => {
    const channel: Channel = {
      ...newChannel(PROJECT_ID, 'Tone Ch'),
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      modeProfiles: [
        {
          ...(defaultModeProfile('fm') as ChannelModeProfileAnalog),
          analogSquelchMode: 'tone',
          rxTone: '88.5',
        },
      ],
    };

    const row = serialiseAnytoneChannelRow(
      { entity: channel, wireName: 'Tone Ch' },
      {
        buildId: 'b1',
        formatId: 'anytone',
        profileId: 'anytone-at-d890uv',
        buildName: 'Test',
        channels: [{ entity: channel, wireName: 'Tone Ch' }],
        zones: [],
        scanLists: [],
        talkGroups: [],
        digitalContacts: [],
        analogContacts: [],
        rxGroupLists: [],
      },
      'anytone-at-d890uv',
      1,
    );

    expect(row['CTCSS/DCS Decode']).toBe('88.5');
    expect(row['Squelch Mode']).toBe('CTCSS/DCS');
  });

  it('serialises MVP file bundle from assembled build', () => {
    const tg = newTalkGroup(PROJECT_ID, 'TG Alpha', 2355);
    const scanListId = 'scan-1';
    const ch1: Channel = {
      ...newChannel(PROJECT_ID, 'Channel 1'),
      scanListId,
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
      modeProfiles: [
        {
          mode: 'dmr' as const,
          colourCode: 1,
          timeslot: 2 as const,
          dmrId: 1234567,
          contactRef: { kind: 'talkGroup' as const, id: tg.id },
          rxGroupListId: null,
        },
      ],
    };
    const ch2: Channel = {
      ...newChannel(PROJECT_ID, 'Channel 2'),
      rxFrequency: 155_000_000,
      txFrequency: 155_000_000,
      modeProfiles: [
        {
          mode: 'dmr' as const,
          colourCode: 1,
          timeslot: 1 as const,
          dmrId: 1234567,
          contactRef: { kind: 'talkGroup' as const, id: tg.id },
          rxGroupListId: null,
        },
      ],
    };
    const zone = {
      ...newZone(PROJECT_ID, 'Zone A'),
      members: [
        { kind: 'channel' as const, channelId: ch1.id },
        { kind: 'channel' as const, channelId: ch2.id },
      ],
    };
    const scanList = {
      ...newScanList(PROJECT_ID, 'Zone A SCL'),
      id: scanListId,
      memberChannelIds: [ch1.id, ch2.id],
    };
    const build = {
      ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv'),
      layout: {
        sections: [
          {
            kind: 'zoneGrouping' as const,
            zones: [{ id: zone.id, name: zone.name, channelIds: [ch1.id, ch2.id] }],
          },
        ],
      },
      exportSettings: { defaultScanInclusion: 'skip' as const },
      zoneOverrides: [{ libraryEntityId: zone.id, wireName: 'Zone A' }],
    };
    const library = {
      channels: [ch1, ch2],
      zones: [zone],
      talkGroups: [tg],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [scanList],
    };

    const assembled = assemble(build, library);
    const files = serialiseAnytoneFiles(assembled, library);

    expect(files['Channel.CSV']).toContain('Channel 1');
    expect(files['DMRZone.CSV']).toContain('Zone A');
    expect(files['ScanList.CSV']).toContain('Zone A SCL');
    expect(files['DMRTalkGroups.CSV']).toContain('TG Alpha');
    expect(files).not.toHaveProperty('RadioIDList.CSV');
    expect(assembled.channels.find((c) => c.entity.id === ch1.id)?.scanListWireName).toBe(
      'Zone A SCL',
    );
  });

  it('shortens long channel names in Channel.CSV export', () => {
    const tg = newTalkGroup(PROJECT_ID, 'TG Alpha', 2355);
    const channel: Channel = {
      ...newChannel(PROJECT_ID, 'Very Long Channel Name That Exceeds Limit'),
      callsign: 'GB3GL',
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
      modeProfiles: [
        {
          mode: 'dmr' as const,
          colourCode: 1,
          timeslot: 2 as const,
          dmrId: 1234567,
          contactRef: { kind: 'talkGroup' as const, id: tg.id },
          rxGroupListId: null,
        },
      ],
    };
    const zone = {
      ...newZone(PROJECT_ID, 'Zone A'),
      members: [{ kind: 'channel' as const, channelId: channel.id }],
    };
    const build = {
      ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv'),
      layout: {
        sections: [
          {
            kind: 'zoneGrouping' as const,
            zones: [{ id: zone.id, name: zone.name, channelIds: [channel.id] }],
          },
        ],
      },
    };
    const library = {
      channels: [channel],
      zones: [zone],
      talkGroups: [tg],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };

    const assembled = assemble(build, library);
    const files = serialiseAnytoneFiles(assembled, library);
    const table = csvToTable(files['Channel.CSV']);
    const nameIndex = table.headers.indexOf('Channel Name');
    const exportedName = table.rows[0]?.[nameIndex] ?? '';

    expect(exportedName.length).toBeLessThanOrEqual(16);
    expect(exportedName).toBeTruthy();
  });

  it('ignores defaultScanInclusion for Scan List column', () => {
    const channel = newChannel(PROJECT_ID, 'Channel 1');
    const row = serialiseAnytoneChannelRow(
      { entity: channel, wireName: 'Channel 1', scanListWireName: 'My List' },
      {
        buildId: 'b1',
        formatId: 'anytone',
        profileId: 'anytone-at-d890uv',
        buildName: 'Test',
        channels: [{ entity: channel, wireName: 'Channel 1', scanListWireName: 'My List' }],
        zones: [],
        scanLists: [],
        talkGroups: [],
        digitalContacts: [],
        analogContacts: [],
        rxGroupLists: [],
      },
      'anytone-at-d890uv',
      1,
      { defaultScanInclusion: 'skip' },
    );

    expect(row['Scan List']).toBe('My List');
  });

  it('serialises DMRDigitalContactList.CSV with 10-column CPS schema', () => {
    const contact = {
      ...newDigitalContact(PROJECT_ID, 'Hiram Percy', 1234567),
      callsign: 'W1AW',
      city: 'Newington',
      state: 'Connecticut',
      country: 'United States',
      remarks: 'ARRL HQ',
    };
    const build = {
      ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv'),
      layout: { sections: [{ kind: 'zoneGrouping' as const, zones: [] }] },
    };
    const library = {
      channels: [],
      zones: [],
      talkGroups: [],
      digitalContacts: [contact],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };

    const assembled = assemble(build, library);
    const files = serialiseAnytoneFiles(assembled, library);
    const table = csvToTable(files['DMRDigitalContactList.CSV']);

    expect(table.headers).toEqual([
      'No.',
      'Radio ID',
      'Callsign',
      'Name',
      'City',
      'State',
      'Country',
      'Remarks',
      'Call Type',
      'Call Alert',
    ]);
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]?.[1]).toBe('1234567');
    expect(table.rows[0]?.[2]).toBe('W1AW');
    expect(table.rows[0]?.[3]).toBe('Hiram Percy');
    expect(table.rows[0]?.[4]).toBe('Newington');
    expect(table.rows[0]?.[5]).toBe('Connecticut');
    expect(table.rows[0]?.[6]).toBe('United States');
    expect(table.rows[0]?.[7]).toBe('ARRL HQ');
    expect(table.rows[0]?.[8]).toBe('Private Call');
    expect(table.rows[0]?.[9]).toBe('None');
  });

  it('composes contact Name from export name mode and allows duplicate names', () => {
    const contactA = {
      ...newDigitalContact(PROJECT_ID, 'Ada', 1001),
      callsign: 'M7ABC',
    };
    const contactB = {
      ...newDigitalContact(PROJECT_ID, 'Bob', 1002),
      callsign: 'M7ABC',
    };
    const build = {
      ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv'),
      layout: { sections: [{ kind: 'zoneGrouping' as const, zones: [] }] },
      exportSettings: { digitalContactExportNameMode: 'callsign-name' as const },
    };
    const library = {
      channels: [],
      zones: [],
      talkGroups: [],
      digitalContacts: [contactA, contactB],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };

    const assembled = assemble(build, library);
    const files = serialiseAnytoneFiles(assembled, library, {
      digitalContactExportNameMode: 'callsign-name',
      shortenNames: false,
    });
    const table = csvToTable(files['DMRDigitalContactList.CSV']);
    const nameIndex = table.headers.indexOf('Name');

    expect(table.rows.map((row) => row[nameIndex])).toEqual(['M7ABC Ada', 'M7ABC Bob']);
    expect(table.rows.every((row) => !/\s2$/.test(row[nameIndex] ?? ''))).toBe(true);
  });

  it('omits zone-derived ScanList.CSV rows when master toggle is off', () => {
    const tg = newTalkGroup(PROJECT_ID, 'TG Alpha', 2355);
    const ch1: Channel = {
      ...newChannel(PROJECT_ID, 'Channel 1'),
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
      modeProfiles: [
        {
          mode: 'dmr' as const,
          colourCode: 1,
          timeslot: 2 as const,
          dmrId: 1234567,
          contactRef: { kind: 'talkGroup' as const, id: tg.id },
          rxGroupListId: null,
        },
      ],
    };
    const zone = {
      ...newZone(PROJECT_ID, 'Zone A'),
      members: [{ kind: 'channel' as const, channelId: ch1.id }],
    };
    const build = {
      ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv'),
      layout: {
        sections: [
          {
            kind: 'zoneGrouping' as const,
            zones: [
              {
                id: zone.id,
                name: zone.name,
                channelIds: [ch1.id],
                exportScanList: true,
              },
            ],
          },
        ],
      },
      zoneOverrides: [{ libraryEntityId: zone.id, wireName: 'Zone A' }],
    };
    const library = {
      channels: [ch1],
      zones: [zone],
      talkGroups: [tg],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };

    const assembled = assemble(build, library);
    const files = serialiseAnytoneFiles(assembled, library, { exportZoneDerivedScanLists: false });
    const table = csvToTable(files['ScanList.CSV']);
    expect(table.rows).toHaveLength(0);
  });

  it('merges zone-derived scan list with library scan list when toggle is on', () => {
    const tg = newTalkGroup(PROJECT_ID, 'TG Alpha', 2355);
    const libraryScanListId = 'scan-lib';
    const ch1: Channel = {
      ...newChannel(PROJECT_ID, 'Channel 1'),
      scanListId: libraryScanListId,
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
      modeProfiles: [
        {
          mode: 'dmr' as const,
          colourCode: 1,
          timeslot: 2 as const,
          dmrId: 1234567,
          contactRef: { kind: 'talkGroup' as const, id: tg.id },
          rxGroupListId: null,
        },
      ],
    };
    const ch2: Channel = {
      ...newChannel(PROJECT_ID, 'Channel 2'),
      rxFrequency: 155_000_000,
      txFrequency: 155_000_000,
      modeProfiles: [
        {
          mode: 'dmr' as const,
          colourCode: 1,
          timeslot: 1 as const,
          dmrId: 1234567,
          contactRef: { kind: 'talkGroup' as const, id: tg.id },
          rxGroupListId: null,
        },
      ],
    };
    const zone = {
      ...newZone(PROJECT_ID, 'Zone B'),
      members: [{ kind: 'channel' as const, channelId: ch2.id }],
    };
    const scanList = {
      ...newScanList(PROJECT_ID, 'Library SCL'),
      id: libraryScanListId,
      memberChannelIds: [ch1.id],
    };
    const build = {
      ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv'),
      layout: {
        sections: [
          {
            kind: 'zoneGrouping' as const,
            zones: [{ id: zone.id, name: zone.name, channelIds: [ch2.id], exportScanList: true }],
          },
        ],
      },
      zoneOverrides: [{ libraryEntityId: zone.id, wireName: 'Zone B' }],
    };
    const library = {
      channels: [ch1, ch2],
      zones: [zone],
      talkGroups: [tg],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [scanList],
    };

    const assembled = assemble(build, library);
    const files = serialiseAnytoneFiles(assembled, library, { exportZoneDerivedScanLists: true });
    const scanTable = csvToTable(files['ScanList.CSV']);
    const channelTable = csvToTable(files['Channel.CSV']);

    expect(scanTable.rows).toHaveLength(2);
    expect(scanTable.rows[0]?.[1]).toBe('Library SCL');
    expect(scanTable.rows[1]?.[1]).toBe('Zone B');

    const scanListIndex = channelTable.headers.indexOf('Scan List');
    const nameIndex = channelTable.headers.indexOf('Channel Name');
    const autoScanIndex = channelTable.headers.indexOf('Auto Scan');
    const ch1Row = channelTable.rows.find((row) => row[nameIndex] === 'Channel 1');
    const ch2Row = channelTable.rows.find((row) => row[nameIndex] === 'Channel 2');
    const carrierRow = channelTable.rows.find((row) => row[nameIndex]?.endsWith(' Scan'));
    expect(ch1Row?.[scanListIndex]).toBe('Library SCL');
    expect(ch2Row?.[scanListIndex]).toBe('None');
    expect(carrierRow?.[scanListIndex]).toBe('Zone B');
    expect(carrierRow?.[autoScanIndex]).toBe('1');

    const zoneTable = csvToTable(files['DMRZone.CSV']);
    const membersIndex = zoneTable.headers.indexOf('Zone Channel Member');
    expect(zoneTable.rows[0]?.[membersIndex]).toMatch(/ Scan\|/);
  });

  it('honours includeInScanList when deriving zone scan members', () => {
    const tg = newTalkGroup(PROJECT_ID, 'TG Alpha', 2355);
    const ch1: Channel = {
      ...newChannel(PROJECT_ID, 'Channel 1'),
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
      modeProfiles: [
        {
          mode: 'dmr' as const,
          colourCode: 1,
          timeslot: 2 as const,
          dmrId: 1234567,
          contactRef: { kind: 'talkGroup' as const, id: tg.id },
          rxGroupListId: null,
        },
      ],
    };
    const ch2: Channel = {
      ...newChannel(PROJECT_ID, 'Channel 2'),
      rxFrequency: 155_000_000,
      txFrequency: 155_000_000,
      modeProfiles: [
        {
          mode: 'dmr' as const,
          colourCode: 1,
          timeslot: 1 as const,
          dmrId: 1234567,
          contactRef: { kind: 'talkGroup' as const, id: tg.id },
          rxGroupListId: null,
        },
      ],
    };
    const zone = {
      ...newZone(PROJECT_ID, 'Zone A'),
      members: [
        { kind: 'channel' as const, channelId: ch1.id },
        { kind: 'channel' as const, channelId: ch2.id, includeInScanList: false },
      ],
    };
    const build = {
      ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv'),
      layout: {
        sections: [
          {
            kind: 'zoneGrouping' as const,
            zones: [
              {
                id: zone.id,
                name: zone.name,
                channelIds: [ch1.id, ch2.id],
                exportScanList: true,
              },
            ],
          },
        ],
      },
      zoneOverrides: [{ libraryEntityId: zone.id, wireName: 'Zone A' }],
    };
    const library = {
      channels: [ch1, ch2],
      zones: [zone],
      talkGroups: [tg],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };

    const assembled = assemble(build, library);
    const files = serialiseAnytoneFiles(assembled, library, { exportZoneDerivedScanLists: true });
    const scanTable = csvToTable(files['ScanList.CSV']);

    expect(scanTable.rows).toHaveLength(1);
    expect(scanTable.rows[0]?.[2]).toBe('Channel 1');
  });

  it('expands RX-list channels with scratch and fans out zone members', () => {
    const tg1 = newTalkGroup(PROJECT_ID, 'Scotland TS2', 950);
    const tg2 = newTalkGroup(PROJECT_ID, 'Scotland TS1', 951);
    const rgl = {
      ...newRxGroupList(PROJECT_ID, 'Scotland'),
      members: [
        { ref: { kind: 'talkGroup' as const, id: tg1.id }, timeSlotOverride: 2 as const },
        { ref: { kind: 'talkGroup' as const, id: tg2.id }, timeSlotOverride: 1 as const },
      ],
    };
    const channel: Channel = {
      ...newChannel(PROJECT_ID, 'Glasgow'),
      callsign: 'GB7GL',
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
      modeProfiles: [
        {
          mode: 'dmr' as const,
          colourCode: 1,
          timeslot: 1 as const,
          dmrId: 1234567,
          contactRef: null,
          rxGroupListId: rgl.id,
        },
      ],
    };
    const zone = {
      ...newZone(PROJECT_ID, 'Zone A'),
      members: [{ kind: 'channel' as const, channelId: channel.id }],
    };
    const build = {
      ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv'),
      layout: {
        sections: [
          {
            kind: 'zoneGrouping' as const,
            zones: [{ id: zone.id, name: zone.name, channelIds: [channel.id] }],
          },
        ],
      },
    };
    const library = {
      channels: [channel],
      zones: [zone],
      talkGroups: [tg1, tg2],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [rgl],
      scanLists: [],
    };

    const assembled = assemble(build, library);
    const files = serialiseAnytoneFiles(assembled, library, {
      expandRxGroupLists: true,
      exportScratchChannels: true,
    });
    const channelTable = csvToTable(files['Channel.CSV']);
    const zoneTable = csvToTable(files['DMRZone.CSV']);

    expect(channelTable.rows).toHaveLength(3);

    const slotIndex = channelTable.headers.indexOf('Slot');
    const rglIndex = channelTable.headers.indexOf('Receive Group List');
    const contactIndex = channelTable.headers.indexOf('Contact/Talk Group');
    const tgRows = channelTable.rows.filter((row) => row[rglIndex] === 'None');
    expect(tgRows).toHaveLength(2);
    expect(tgRows.map((row) => row[contactIndex])).toEqual(
      expect.arrayContaining(['Scotland TS2', 'Scotland TS1']),
    );
    const slots = tgRows.map((row) => row[slotIndex]);
    expect(slots).toEqual(expect.arrayContaining(['2', '1']));

    const scratchRow = channelTable.rows.find((row) => row[rglIndex] === 'Scotland');
    expect(scratchRow).toBeDefined();
    expect(scratchRow?.[contactIndex]).toBe('');

    const membersIndex = zoneTable.headers.indexOf('Zone Channel Member');
    const zoneMembers = zoneTable.rows[0]?.[membersIndex]?.split('|') ?? [];
    expect(zoneMembers).toHaveLength(3);
  });

  it('omits AMAir receive-bank channels from zone-derived ScanList.CSV members', () => {
    const tg = newTalkGroup(PROJECT_ID, 'TG Alpha', 2355);
    const dmr: Channel = {
      ...newChannel(PROJECT_ID, 'GB3AO Aboyne'),
      rxFrequency: 430_975_000,
      txFrequency: 438_575_000,
      modeProfiles: [
        {
          mode: 'dmr' as const,
          colourCode: 1,
          timeslot: 1 as const,
          dmrId: 1234567,
          contactRef: { kind: 'talkGroup' as const, id: tg.id },
          rxGroupListId: null,
        },
      ],
    };
    const airband: Channel = {
      ...newChannel(PROJECT_ID, 'Aboyne Info'),
      rxFrequency: 118_665_000,
      txFrequency: null,
      forbidTransmit: 'forbid',
      modeProfiles: [
        {
          mode: 'am' as const,
          squelch: null,
          rxTone: 'none' as const,
          txTone: 'none' as const,
          bandwidthKHz: 8.33,
        },
      ],
    };
    const zone = {
      ...newZone(PROJECT_ID, 'Aboyne'),
      members: [
        { kind: 'channel' as const, channelId: dmr.id },
        { kind: 'channel' as const, channelId: airband.id },
      ],
    };
    const build = {
      ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv'),
      layout: {
        sections: [
          {
            kind: 'zoneGrouping' as const,
            zones: [
              {
                id: zone.id,
                name: zone.name,
                channelIds: [dmr.id, airband.id],
                exportScanList: true,
              },
            ],
          },
        ],
      },
    };
    const library = {
      channels: [dmr, airband],
      zones: [zone],
      talkGroups: [tg],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };

    const assembled = assemble(build, library);
    const files = serialiseAnytoneFiles(assembled, library, { exportZoneDerivedScanLists: true });
    const scanTable = csvToTable(files['ScanList.CSV']);
    const membersIndex = scanTable.headers.indexOf('Scan Channel Member');
    const members = scanTable.rows[0]?.[membersIndex] ?? '';
    expect(members).toContain('GB3AO Aboyne');
    expect(members).not.toContain('Aboyne Info');
  });
});
