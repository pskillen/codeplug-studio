import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import { newChannel, newFormatBuild, newTalkGroup, newZone } from '@core/domain/factories.ts';
import { assemble, type LibrarySlice } from '@core/services/assemble.ts';
import { serialiseDm32Files } from './serialise.ts';
import { CHANNEL_COL, ZONE_COL } from './columns.ts';
import { parseCsv } from '../../../../test/csvParse.ts';

const PROJECT_ID = 'proj-1';

function fmChannel(name: string, overrides: Partial<Channel> = {}): Channel {
  return {
    ...newChannel(PROJECT_ID, name),
    rxFrequency: 430_012_500,
    txFrequency: 430_012_500,
    modeProfiles: [
      { mode: 'fm', squelch: 50, rxTone: 'none', txTone: 'none', bandwidthKHz: 12.5 },
    ],
    ...overrides,
  };
}

function dm32Build(): FormatBuild {
  return newFormatBuild(PROJECT_ID, 'dm32-baofeng-dm32uv', 'DM32 test');
}

describe('DM32 export serialise', () => {
  it('serialises a minimal channel to Channels.csv', () => {
    const channel = fmChannel('GB3DA');
    const build = dm32Build();
    const library: LibrarySlice = {
      channels: [channel],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
    };
    const assembled = assemble(build, library);
    const files = serialiseDm32Files(assembled, library);
    const rows = parseCsv(files['Channels.csv']);
    const headers = rows[0]!;
    const nameIndex = headers.indexOf(CHANNEL_COL.name);
    expect(rows[1]?.[nameIndex]).toBe('GB3DA');
  });

  it('serialises zones with pipe-separated member names', () => {
    const channel = fmChannel('Test Chan');
    const zone = newZone(PROJECT_ID, 'My Zone');
    zone.members = [{ kind: 'channel', id: channel.id }];
    const build = dm32Build();
    const library: LibrarySlice = {
      channels: [channel],
      zones: [zone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
    };
    const assembled = assemble(build, library);
    const files = serialiseDm32Files(assembled, library);
    const rows = parseCsv(files['Zones.csv']);
    const headers = rows[0]!;
    const membersIndex = headers.indexOf(ZONE_COL.members);
    expect(rows[1]?.[membersIndex]).toBe('Test Chan');
  });

  it('expands RX group list members into separate channel rows', () => {
    const tg1 = newTalkGroup(PROJECT_ID, 'Worldwide', 1);
    const tg2 = newTalkGroup(PROJECT_ID, 'Local', 2);
    const channel: Channel = {
      ...newChannel(PROJECT_ID, 'GB7RR'),
      rxFrequency: 430_000_000,
      txFrequency: 430_000_000,
      modeProfiles: [
        {
          mode: 'dmr',
          colourCode: 1,
          timeslot: 1,
          dmrId: null,
          contactRef: null,
          rxGroupListId: 'rgl-1',
        },
      ],
    };
    const build = dm32Build();
    const library: LibrarySlice = {
      channels: [channel],
      talkGroups: [tg1, tg2],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [
        {
          id: 'rgl-1',
          projectId: PROJECT_ID,
          revision: channel.revision,
          updatedAt: channel.updatedAt,
          createdAt: channel.createdAt,
          name: 'My RGL',
          members: [
            { ref: { kind: 'talkGroup', id: tg1.id } },
            { ref: { kind: 'talkGroup', id: tg2.id } },
          ],
        },
      ],
      zones: [],
    };
    const assembled = assemble(build, library);
    const files = serialiseDm32Files(assembled, library);
    const rows = parseCsv(files['Channels.csv']);
    expect(rows.length).toBe(3);
  });
});
