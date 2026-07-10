import { describe, expect, it } from 'vitest';
import {
  newChannel,
  newFormatBuild,
  newRxGroupList,
  newTalkGroup,
  newZone,
} from '@core/domain/factories.ts';
import { assemble } from '@core/services/assemble.ts';
import type { ChannelModeProfileDMR } from '@core/models/library.ts';
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
      members: [{ channelId: channel.id, includeInScanList: true }],
    };
    const build = {
      ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv'),
      layout: {
        sections: [
          {
            trait: 'zoneGrouping',
            zones: [{ zoneId: zone.id, channelIds: [channel.id] }],
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
      tgRows.map((row) => [row.txContactRef?.id, (row.modeProfile as ChannelModeProfileDMR).timeslot]),
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
});
