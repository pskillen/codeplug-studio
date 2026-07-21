import { describe, expect, it } from 'vitest';
import {
  newChannel,
  newFormatBuild,
  newRxGroupList,
  newTalkGroup,
} from '@core/domain/factories.ts';
import { assemble } from '@core/services/assemble.ts';
import type { ChannelModeProfileDMR } from '@core/models/library.ts';
import {
  expandAllNeonplugChannelsForExport,
  expandNeonplugChannelWireRows,
  expandNeonplugZoneMemberNumbers,
  neonplugChannelExpansionById,
} from './channelExpansion.ts';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function dmrRepeaterChannel(name: string, rxGroupListId: string): ReturnType<typeof newChannel> {
  return {
    ...newChannel(PROJECT_ID, name),
    rxFrequency: 438_800_000,
    txFrequency: 434_000_000,
    modeProfiles: [
      {
        mode: 'dmr',
        colourCode: 1,
        timeslot: 1,
        dmrId: 1234567,
        contactRef: null,
        rxGroupListId,
      } satisfies ChannelModeProfileDMR,
    ],
  };
}

describe('neonplug channelExpansion', () => {
  it('appends one scratch row per expanded repeater when enabled', () => {
    const tg = newTalkGroup(PROJECT_ID, 'Scotland', 950);
    const rgl = {
      ...newRxGroupList(PROJECT_ID, 'Scotland'),
      members: [{ ref: { kind: 'talkGroup' as const, id: tg.id } }],
    };
    const channel = dmrRepeaterChannel('Glasgow', rgl.id);
    const build = newFormatBuild(PROJECT_ID, 'neonplug-dm32uv');
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

    const rows = expandNeonplugChannelWireRows(
      assembledChannel,
      assembled,
      library,
      { expandRxGroupLists: true, exportScratchChannels: true, profileId: 'neonplug-dm32uv' },
      new Set(),
      [],
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]?.rowKind).toBe('talkGroup');
    expect(rows[0]?.txContactRef).toEqual({ kind: 'talkGroup', id: tg.id });
    expect(rows[0]?.rxGroupListId).toBeNull();
    const scratch = rows.find((row) => row.rowKind === 'scratch');
    expect(scratch).toBeDefined();
    expect(scratch?.key).toBe(`${channel.id}:scratch`);
    expect(scratch?.wireName.length).toBeLessThanOrEqual(16);
    expect(scratch?.rxGroupListId).toBe(rgl.id);
    expect(scratch?.txContactRef).toBeNull();
  });

  it('returns lean row when expansion is disabled', () => {
    const tg = newTalkGroup(PROJECT_ID, 'Scotland', 950);
    const rgl = {
      ...newRxGroupList(PROJECT_ID, 'Scotland'),
      members: [{ ref: { kind: 'talkGroup' as const, id: tg.id } }],
    };
    const channel = dmrRepeaterChannel('Glasgow', rgl.id);
    const build = newFormatBuild(PROJECT_ID, 'neonplug-dm32uv');
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

    const rows = expandAllNeonplugChannelsForExport(assembled, library, {
      expandRxGroupLists: false,
      exportScratchChannels: true,
      profileId: 'neonplug-dm32uv',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.rowKind).toBe('lean');
    expect(rows[0]?.rxGroupListId).toBe(rgl.id);
  });

  it('omits scratch when exportScratchChannels is false', () => {
    const tg = newTalkGroup(PROJECT_ID, 'Scotland', 950);
    const rgl = {
      ...newRxGroupList(PROJECT_ID, 'Scotland'),
      members: [{ ref: { kind: 'talkGroup' as const, id: tg.id } }],
    };
    const channel = dmrRepeaterChannel('Glasgow', rgl.id);
    const build = newFormatBuild(PROJECT_ID, 'neonplug-dm32uv');
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

    const rows = expandAllNeonplugChannelsForExport(assembled, library, {
      expandRxGroupLists: true,
      exportScratchChannels: false,
      profileId: 'neonplug-dm32uv',
    });

    expect(rows.every((row) => row.rowKind === 'talkGroup')).toBe(true);
    expect(rows).toHaveLength(1);
  });

  it('skips expansion when TX contact and RX group list are both set', () => {
    const tg = newTalkGroup(PROJECT_ID, 'Scotland', 950);
    const rgl = {
      ...newRxGroupList(PROJECT_ID, 'Scotland'),
      members: [{ ref: { kind: 'talkGroup' as const, id: tg.id } }],
    };
    const channel = {
      ...dmrRepeaterChannel('Glasgow', rgl.id),
      modeProfiles: [
        {
          mode: 'dmr' as const,
          colourCode: 1,
          timeslot: 1 as const,
          dmrId: 1234567,
          contactRef: { kind: 'talkGroup' as const, id: tg.id },
          rxGroupListId: rgl.id,
        } satisfies ChannelModeProfileDMR,
      ],
    };
    const build = newFormatBuild(PROJECT_ID, 'neonplug-dm32uv');
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

    const rows = expandAllNeonplugChannelsForExport(assembled, library, {
      expandRxGroupLists: true,
      exportScratchChannels: true,
      profileId: 'neonplug-dm32uv',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.rowKind).toBe('lean');
    expect(rows[0]?.txContactRef).toEqual({ kind: 'talkGroup', id: tg.id });
    expect(rows[0]?.rxGroupListId).toBe(rgl.id);
  });

  it('fans out zone member numbers from expansion map', () => {
    const numbersBySource = new Map<string, readonly number[]>([
      ['ch-a', [1, 2, 3]],
      ['ch-b', [4]],
    ]);
    expect(expandNeonplugZoneMemberNumbers(['ch-a', 'ch-b'], numbersBySource)).toEqual([
      1, 2, 3, 4,
    ]);
    expect(expandNeonplugZoneMemberNumbers(['missing'], numbersBySource)).toEqual([]);
  });

  it('groups expanded rows by source channel id', () => {
    const tg1 = newTalkGroup(PROJECT_ID, 'TG1', 1);
    const tg2 = newTalkGroup(PROJECT_ID, 'TG2', 2);
    const rgl = {
      ...newRxGroupList(PROJECT_ID, 'List'),
      members: [
        { ref: { kind: 'talkGroup' as const, id: tg1.id } },
        { ref: { kind: 'talkGroup' as const, id: tg2.id } },
      ],
    };
    const channel = dmrRepeaterChannel('Site', rgl.id);
    const build = newFormatBuild(PROJECT_ID, 'neonplug-dm32uv');
    const library = {
      channels: [channel],
      zones: [],
      talkGroups: [tg1, tg2],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [rgl],
      scanLists: [],
    };
    const assembled = assemble(build, library);
    const rows = expandAllNeonplugChannelsForExport(assembled, library, {
      expandRxGroupLists: true,
      exportScratchChannels: false,
      profileId: 'neonplug-dm32uv',
    });
    const byId = neonplugChannelExpansionById(rows);
    expect(byId.get(channel.id)).toHaveLength(2);
  });
});
