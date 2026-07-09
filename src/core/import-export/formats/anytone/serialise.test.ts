import { describe, expect, it } from 'vitest';
import {
  newChannel,
  newDigitalContact,
  newFormatBuild,
  newScanList,
  newTalkGroup,
  newZone,
} from '@core/domain/factories.ts';
import { assemble } from '@core/services/assemble.ts';
import { csvToTable } from '@core/import-export/csvParse.ts';
import { serialiseAnytoneFiles } from './serialise.ts';
import { serialiseAnytoneChannelRow } from './channelWire.ts';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

describe('anytone serialise', () => {
  it('serialises DMR channel core columns', () => {
    const tg = newTalkGroup(PROJECT_ID, 'TG Alpha', 2355);
    const channel = {
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
    expect(row['DMR MODE']).toBe('1');
    expect(row['Transmit Power']).toBe('Low');
    expect(row['Contact/Talk Group']).toBe('TG Alpha');
    expect(row['Scan List']).toBe('Zone A SCL');
  });

  it('serialises MVP file bundle from assembled build', () => {
    const tg = newTalkGroup(PROJECT_ID, 'TG Alpha', 2355);
    const scanListId = 'scan-1';
    const ch1 = {
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
    const ch2 = {
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
    const channel = {
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
    const contact = newDigitalContact(PROJECT_ID, 'MM0HAM', 1234567);
    const build = {
      ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv'),
      layout: { sections: [{ kind: 'zoneGrouping' as const, zones: [] }] },
      contactOverrides: [{ libraryEntityId: contact.id, wireName: 'MM0HAM' }],
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
    expect(table.rows[0]?.[3]).toBe('MM0HAM');
    expect(table.rows[0]?.[8]).toBe('Private Call');
    expect(table.rows[0]?.[9]).toBe('None');
  });

  it('omits zone-derived ScanList.CSV rows when master toggle is off', () => {
    const tg = newTalkGroup(PROJECT_ID, 'TG Alpha', 2355);
    const ch1 = {
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
    const ch1 = {
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
    const ch2 = {
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
            zones: [
              { id: zone.id, name: zone.name, channelIds: [ch2.id], exportScanList: true },
            ],
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
    expect(scanTable.rows[1]?.[1]).toBe('Zone B 2');

    const scanListIndex = channelTable.headers.indexOf('Scan List');
    const nameIndex = channelTable.headers.indexOf('Channel Name');
    const ch1Row = channelTable.rows.find((row) => row[nameIndex] === 'Channel 1');
    const ch2Row = channelTable.rows.find((row) => row[nameIndex] === 'Channel 2');
    expect(ch1Row?.[scanListIndex]).toBe('Library SCL');
    expect(ch2Row?.[scanListIndex]).toBe('Zone B 2');
  });

  it('honours includeInScanList when deriving zone scan members', () => {
    const tg = newTalkGroup(PROJECT_ID, 'TG Alpha', 2355);
    const ch1 = {
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
    const ch2 = {
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
});
