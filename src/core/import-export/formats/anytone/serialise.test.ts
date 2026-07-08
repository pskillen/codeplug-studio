import { describe, expect, it } from 'vitest';
import { newChannel, newFormatBuild, newTalkGroup, newZone } from '@core/domain/factories.ts';
import { assemble } from '@core/services/assemble.ts';
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
    expect(row['Transmit Power']).toBe('Low');
    expect(row['Contact/Talk Group']).toBe('TG Alpha');
    expect(row['Scan List']).toBe('Zone A SCL');
  });

  it('serialises MVP file bundle from assembled build', () => {
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
        { kind: 'channel' as const, channelId: ch2.id },
      ],
    };
    const scanListId = 'scan-1';
    const build = {
      ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv'),
      layout: {
        sections: [
          {
            kind: 'zoneGrouping' as const,
            zones: [{ id: zone.id, name: zone.name, channelIds: [ch1.id, ch2.id] }],
          },
          {
            kind: 'scanLists' as const,
            scanLists: [{ id: scanListId, name: 'Zone A SCL', channelIds: [ch1.id, ch2.id] }],
          },
        ],
      },
      channelOverrides: [{ libraryEntityId: ch1.id, scanListId }],
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
    const files = serialiseAnytoneFiles(assembled, library);

    expect(files['Channel.CSV']).toContain('Channel 1');
    expect(files['DMRZone.CSV']).toContain('Zone A');
    expect(files['ScanList.CSV']).toContain('Zone A SCL');
    expect(files['DMRTalkGroups.CSV']).toContain('TG Alpha');
    expect(files['RadioIDList.CSV']).toContain('TEST01');
  });
});
