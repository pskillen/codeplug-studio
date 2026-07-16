import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import {
  newChannel,
  newFormatBuild,
  newRxGroupList,
  newScanList,
  newTalkGroup,
  newZone,
} from '@core/domain/factories.ts';
import { assemble } from '@core/services/assemble.ts';
import { csvToTable } from '@core/import-export/csvParse.ts';
import { exportBuildAll } from '@core/services/exportBuild.ts';
import { previewWireRows } from '@core/services/previewWireRows.ts';
import { serialiseAnytoneFiles } from './serialise.ts';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const LONG_TG_NAME = 'Scotland West Regional Talk Group';
const LONG_ZONE_NAME = 'GLA GLASGOW TOWER ZONE NAME';
const LONG_RGL_NAME = 'Scotland West Receive Group List';
const LONG_CHANNEL_NAME = 'Very Long DMR Channel Name';
const LONG_AIR_NAME = 'GLA GLASGOW TOWER AIRBAND';

function cell(table: ReturnType<typeof csvToTable>, rowIndex: number, column: string): string {
  const colIndex = table.headers.indexOf(column);
  return table.rows[rowIndex]?.[colIndex] ?? '';
}

describe('anytone export wire context', () => {
  it('uses consistent shortened wire names across export files', () => {
    const tg = newTalkGroup(PROJECT_ID, LONG_TG_NAME, 23551);
    const rgl = {
      ...newRxGroupList(PROJECT_ID, LONG_RGL_NAME),
      members: [{ ref: { kind: 'talkGroup' as const, id: tg.id } }],
    };
    const dmrChannel: Channel = {
      ...newChannel(PROJECT_ID, LONG_CHANNEL_NAME),
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
      modeProfiles: [
        {
          mode: 'dmr' as const,
          colourCode: 1,
          timeslot: 1 as const,
          dmrId: 1234567,
          contactRef: { kind: 'talkGroup' as const, id: tg.id },
          rxGroupListId: rgl.id,
        },
      ],
    };
    const airChannel: Channel = {
      ...newChannel(PROJECT_ID, LONG_AIR_NAME),
      rxFrequency: 118_800_000,
      txFrequency: null,
      forbidTransmit: 'forbid',
      modeProfiles: [defaultModeProfile('am')],
    };
    const scanListId = 'scan-long';
    const scanList = {
      ...newScanList(PROJECT_ID, 'Very Long Scan List Name Here'),
      id: scanListId,
      memberChannelIds: [dmrChannel.id],
    };
    const zone = {
      ...newZone(PROJECT_ID, LONG_ZONE_NAME),
      members: [
        { kind: 'channel' as const, channelId: dmrChannel.id },
        { kind: 'channel' as const, channelId: airChannel.id },
      ],
    };
    const build = {
      ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv'),
      layout: {
        sections: [
          {
            kind: 'zoneGrouping' as const,
            zones: [{ id: zone.id, name: zone.name, channelIds: [dmrChannel.id, airChannel.id] }],
          },
        ],
      },
      exportSettings: { shortenNames: true },
    };
    const library = {
      channels: [dmrChannel, airChannel],
      zones: [zone],
      talkGroups: [tg],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [rgl],
      scanLists: [scanList],
    };

    const assembled = assemble(build, library);
    const files = serialiseAnytoneFiles(assembled, library, {
      profileId: 'anytone-at-d890uv',
      shortenNames: true,
      expandRxGroupLists: false,
      exportScratchChannels: false,
    });
    const fullExport = exportBuildAll({ build, library });
    const amAirCsv = fullExport.files['AMAir.CSV']!;

    const channelTable = csvToTable(files['Channel.CSV']);
    const zoneTable = csvToTable(files['DMRZone.CSV']);
    const tgTable = csvToTable(files['DMRTalkGroups.CSV']);
    const rglTable = csvToTable(files['DMRReceiveGroupCallList.CSV']);
    const scanTable = csvToTable(files['ScanList.CSV']);
    const amAirTable = csvToTable(amAirCsv);
    const amZoneTable = csvToTable(fullExport.files['AMZone.CSV']!);

    const channelName = cell(channelTable, 0, 'Channel Name');
    const tgName = cell(tgTable, 0, 'Name');
    const rglContact = cell(rglTable, 0, 'Contact').split('|')[0] ?? '';
    const zoneMembers = cell(zoneTable, 0, 'Zone Channel Member').split('|');
    const amZoneMembers = cell(amZoneTable, 0, 'Zone Channel Member').split('|');
    const scanMembers = cell(scanTable, 0, 'Scan Channel Member').split('|');
    const amAirName = cell(amAirTable, 0, 'Name').trim();

    expect(channelName.length).toBeLessThanOrEqual(16);
    expect(tgName.length).toBeLessThanOrEqual(16);
    expect(rglContact.length).toBeLessThanOrEqual(16);
    expect(tgName).toBe(rglContact);
    expect(zoneMembers).toEqual([channelName]);
    expect(amZoneMembers).toEqual([amAirName]);
    expect(scanMembers[0]).toBe(channelName);
    expect(amAirName.length).toBeLessThanOrEqual(16);
  });

  it('zone-derived scan list wire name matches zone wire name', () => {
    const tg = newTalkGroup(PROJECT_ID, 'TG Alpha', 2355);
    const ch: Channel = {
      ...newChannel(PROJECT_ID, 'Channel 1'),
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
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
      ...newZone(PROJECT_ID, 'Zone Alpha'),
      members: [{ kind: 'channel' as const, channelId: ch.id }],
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
                channelIds: [ch.id],
                exportScanList: true,
              },
            ],
          },
        ],
      },
      zoneOverrides: [{ libraryEntityId: zone.id, wireName: 'Zone Alpha' }],
    };
    const library = {
      channels: [ch],
      zones: [zone],
      talkGroups: [tg],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };

    const assembled = assemble(build, library);
    const files = serialiseAnytoneFiles(assembled, library, { exportZoneDerivedScanLists: true });
    const zoneTable = csvToTable(files['DMRZone.CSV']);
    const scanTable = csvToTable(files['ScanList.CSV']);

    const zoneName = cell(zoneTable, 0, 'Zone Name');
    const scanListName = cell(scanTable, 0, 'Scan List Name');
    expect(scanListName).toBe(zoneName);
    expect(scanListName).toBe('Zone Alpha');
    expect(scanListName).not.toMatch(/ 2$/);
  });

  it('zone-derived scan carrier names exist in Channel.CSV without template callsign prefix', () => {
    const tg = newTalkGroup(PROJECT_ID, 'TG Alpha', 2355);
    const templateChannel: Channel = {
      ...newChannel(PROJECT_ID, 'GB7EM Aberdeen'),
      callsign: 'GB7EM',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
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
    const glasgowChannel: Channel = {
      ...newChannel(PROJECT_ID, 'Glasgow Chan'),
      callsign: 'GB7GL',
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
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
    const edinburghChannel: Channel = {
      ...newChannel(PROJECT_ID, 'Edinburgh Chan'),
      callsign: 'GB7EM',
      rxFrequency: 439_000_000,
      txFrequency: 434_200_000,
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
    const glasgowZone = {
      ...newZone(PROJECT_ID, 'Glasgow'),
      members: [{ kind: 'channel' as const, channelId: glasgowChannel.id }],
    };
    const edinburghZone = {
      ...newZone(PROJECT_ID, 'Edinburgh'),
      members: [{ kind: 'channel' as const, channelId: edinburghChannel.id }],
    };
    const build = {
      ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv'),
      layout: {
        sections: [
          {
            kind: 'zoneGrouping' as const,
            zones: [
              {
                id: glasgowZone.id,
                name: glasgowZone.name,
                channelIds: [glasgowChannel.id],
                exportScanList: true,
              },
              {
                id: edinburghZone.id,
                name: edinburghZone.name,
                channelIds: [edinburghChannel.id],
                exportScanList: true,
              },
            ],
          },
        ],
      },
      zoneOverrides: [
        { libraryEntityId: glasgowZone.id, wireName: 'Glasgow' },
        { libraryEntityId: edinburghZone.id, wireName: 'Edinburgh' },
      ],
    };
    const library = {
      channels: [templateChannel, glasgowChannel, edinburghChannel],
      zones: [glasgowZone, edinburghZone],
      talkGroups: [tg],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };

    const assembled = assemble(build, library);
    const files = serialiseAnytoneFiles(assembled, library, {
      exportZoneDerivedScanLists: true,
      shortenNames: true,
    });
    const channelTable = csvToTable(files['Channel.CSV']);
    const zoneTable = csvToTable(files['DMRZone.CSV']);
    const nameIndex = channelTable.headers.indexOf('Channel Name');
    const channelNames = new Set(channelTable.rows.map((row) => row[nameIndex]?.trim() ?? ''));
    const membersIndex = zoneTable.headers.indexOf('Zone Channel Member');

    for (const zoneRow of zoneTable.rows) {
      const members = (zoneRow[membersIndex] ?? '').split('|').filter(Boolean);
      const carrierName = members[0] ?? '';
      expect(channelNames.has(carrierName)).toBe(true);
      expect(carrierName.endsWith(' Scan')).toBe(true);
      expect(carrierName).not.toMatch(/^GB7EM /);
    }
  });
});

describe('anytone wire preview list limits', () => {
  it('shortens zone, scan list, and RX group list wire names at profile limit', () => {
    const tg = newTalkGroup(PROJECT_ID, LONG_TG_NAME, 23551);
    const rgl = {
      ...newRxGroupList(PROJECT_ID, LONG_RGL_NAME),
      members: [{ ref: { kind: 'talkGroup' as const, id: tg.id } }],
    };
    const channel: Channel = {
      ...newChannel(PROJECT_ID, LONG_CHANNEL_NAME),
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
      modeProfiles: [
        {
          mode: 'dmr' as const,
          colourCode: 1,
          timeslot: 1 as const,
          dmrId: 1234567,
          contactRef: { kind: 'talkGroup' as const, id: tg.id },
          rxGroupListId: rgl.id,
        },
      ],
    };
    const scanList = {
      ...newScanList(PROJECT_ID, 'Very Long Scan List Name Here'),
      memberChannelIds: [channel.id],
    };
    const zone = {
      ...newZone(PROJECT_ID, LONG_ZONE_NAME),
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
      exportSettings: { shortenNames: true },
    };
    const library = {
      channels: [channel],
      zones: [zone],
      talkGroups: [tg],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [rgl],
      scanLists: [scanList],
    };

    const zoneRow = previewWireRows(build, library, 'zone')[0];
    const scanRow = previewWireRows(build, library, 'scanList')[0];
    const rglRow = previewWireRows(build, library, 'rxGroupList')[0];

    expect(zoneRow?.effectiveWireName.length).toBeLessThanOrEqual(16);
    expect(scanRow?.effectiveWireName.length).toBeLessThanOrEqual(16);
    expect(rglRow?.effectiveWireName.length).toBeLessThanOrEqual(16);
  });
});
