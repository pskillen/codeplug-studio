import { describe, expect, it } from 'vitest';
import {
  newChannel,
  newFormatBuild,
  newRxGroupList,
  newTalkGroup,
  newZone,
} from '@core/domain/factories.ts';
import { assemble } from '@core/services/assemble.ts';
import type { Channel, ChannelModeProfileDMR } from '@core/models/library.ts';
import {
  expandAllAnytoneChannelsForExport,
  expandAnytoneChannelWireRows,
} from './channelExpansion.ts';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function dmrRepeaterChannel(
  name: string,
  rxGroupListId: string,
  timeslot: 1 | 2 = 1,
): ReturnType<typeof newChannel> {
  return {
    ...newChannel(PROJECT_ID, name),
    callsign: 'GB7GL',
    rxFrequency: 438_800_000,
    txFrequency: 434_000_000,
    modeProfiles: [
      {
        mode: 'dmr',
        colourCode: 1,
        timeslot,
        dmrId: 1234567,
        contactRef: null,
        rxGroupListId,
      } satisfies ChannelModeProfileDMR,
    ],
  };
}

describe('anytone channelExpansion', () => {
  it('expands one row per RX-list member with cleared RGL and member contact', () => {
    const tg1 = newTalkGroup(PROJECT_ID, 'Scotland TS2', 950);
    const tg2 = newTalkGroup(PROJECT_ID, 'Scotland TS1', 951);
    const rgl = {
      ...newRxGroupList(PROJECT_ID, 'Scotland'),
      members: [
        { ref: { kind: 'talkGroup' as const, id: tg1.id }, timeSlotOverride: 2 as const },
        { ref: { kind: 'talkGroup' as const, id: tg2.id }, timeSlotOverride: 1 as const },
      ],
    };
    const channel = dmrRepeaterChannel('Glasgow', rgl.id, 1);
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

    const rows = expandAllAnytoneChannelsForExport(assembled, library, {
      expandRxGroupLists: true,
      exportScratchChannels: true,
      profileId: 'anytone-at-d890uv',
    });

    const tgRows = rows.filter((row) => row.rowKind === 'talkGroup');
    expect(tgRows).toHaveLength(2);
    expect(tgRows.every((row) => row.rxGroupListId === null)).toBe(true);
    expect(tgRows.map((row) => row.txContactRef?.id)).toEqual(
      expect.arrayContaining([tg1.id, tg2.id]),
    );

    const slotByTg = new Map(
      tgRows.map((row) => [
        row.txContactRef?.id,
        (row.modeProfile as ChannelModeProfileDMR).timeslot,
      ]),
    );
    expect(slotByTg.get(tg1.id)).toBe(2);
    expect(slotByTg.get(tg2.id)).toBe(1);
  });

  it('appends one scratch row per expanded repeater when enabled', () => {
    const tg = newTalkGroup(PROJECT_ID, 'Scotland TS2', 950);
    const rgl = {
      ...newRxGroupList(PROJECT_ID, 'Scotland'),
      members: [{ ref: { kind: 'talkGroup' as const, id: tg.id } }],
    };
    const channel = dmrRepeaterChannel('Glasgow', rgl.id);
    const build = newFormatBuild(PROJECT_ID, 'anytone-at-d890uv');
    const library = {
      channels: [channel],
      zones: [],
      talkGroups: [tg],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [rgl],
      scanLists: [],
    };
    const assembled = assemble(build, library);
    const assembledChannel = assembled.channels[0]!;

    const rows = expandAnytoneChannelWireRows(
      assembledChannel,
      assembled,
      library,
      { expandRxGroupLists: true, exportScratchChannels: true, profileId: 'anytone-at-d890uv' },
      new Set(),
      [],
    );

    expect(rows).toHaveLength(2);
    const scratch = rows.find((row) => row.rowKind === 'scratch');
    expect(scratch).toBeDefined();
    expect(scratch?.key).toBe(`${channel.id}:scratch`);
    expect(scratch?.wireName.length).toBeLessThanOrEqual(16);
    expect(scratch?.rxGroupListId).toBe(rgl.id);
    expect(scratch?.txContactRef).toBeNull();
  });

  it('returns lean row when expansion is disabled', () => {
    const tg = newTalkGroup(PROJECT_ID, 'Scotland TS2', 950);
    const rgl = {
      ...newRxGroupList(PROJECT_ID, 'Scotland'),
      members: [{ ref: { kind: 'talkGroup' as const, id: tg.id } }],
    };
    const channel = dmrRepeaterChannel('Glasgow', rgl.id);
    const build = newFormatBuild(PROJECT_ID, 'anytone-at-d890uv');
    const library = {
      channels: [channel],
      zones: [],
      talkGroups: [tg],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [rgl],
      scanLists: [],
    };
    const assembled = assemble(build, library);

    const rows = expandAllAnytoneChannelsForExport(assembled, library, {
      expandRxGroupLists: false,
      exportScratchChannels: true,
      profileId: 'anytone-at-d890uv',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.rowKind).toBe('lean');
    expect(rows[0]?.rxGroupListId).toBe(rgl.id);
  });

  it('RX-expanded hotspot uses Hspt prefix without phantom disambiguation', () => {
    const hsptOccupier: Channel = {
      ...newChannel(PROJECT_ID, 'Hspt'),
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      modeProfiles: [
        {
          mode: 'fm' as const,
          squelch: null,
          rxTone: 'none' as const,
          txTone: 'none' as const,
          bandwidthKHz: 12.5,
        },
      ],
    };
    const tgScotland = newTalkGroup(PROJECT_ID, 'Scotland', 23550);
    const tg2357910 = newTalkGroup(PROJECT_ID, 'TG 2357910', 2357910);
    const rgl = {
      ...newRxGroupList(PROJECT_ID, 'Hotspot RX'),
      members: [
        { ref: { kind: 'talkGroup' as const, id: tgScotland.id } },
        { ref: { kind: 'talkGroup' as const, id: tg2357910.id } },
      ],
    };
    const hotspot: Channel = {
      ...newChannel(PROJECT_ID, 'Hotspot'),
      abbreviation: 'Hspt',
      callsign: '',
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
      modeProfiles: [
        {
          mode: 'dmr',
          colourCode: 1,
          timeslot: 1 as const,
          dmrId: 1234567,
          contactRef: { kind: 'talkGroup' as const, id: tgScotland.id },
          rxGroupListId: rgl.id,
        } satisfies ChannelModeProfileDMR,
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
                id: 'zone-hotspot',
                name: 'Hotspot zone',
                channelIds: [hsptOccupier.id, hotspot.id],
              },
            ],
          },
        ],
      },
    };
    const library = {
      channels: [hsptOccupier, hotspot],
      zones: [],
      talkGroups: [tgScotland, tg2357910],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [rgl],
      scanLists: [],
    };
    const assembled = assemble(build, library);

    const rows = expandAllAnytoneChannelsForExport(assembled, library, {
      expandRxGroupLists: true,
      exportScratchChannels: true,
      profileId: 'anytone-at-d890uv',
      shortenNames: true,
      useChannelAbbreviation: true,
    });

    const hotspotRows = rows.filter((row) => row.sourceChannelId === hotspot.id);
    const tgRows = hotspotRows.filter((row) => row.rowKind === 'talkGroup');
    expect(tgRows.length).toBeGreaterThanOrEqual(2);

    for (const row of tgRows) {
      expect(row.wireName).toMatch(/^Hspt /);
      expect(row.wireName).not.toMatch(/^Hspt 2/);
      expect(row.wireName).not.toMatch(/^\s+\d+ /);
    }

    const scratch = hotspotRows.find((row) => row.rowKind === 'scratch');
    expect(scratch?.wireName).toMatch(/^Hspt .*Scratch/);
  });
});
