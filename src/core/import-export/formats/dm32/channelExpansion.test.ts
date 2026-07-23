import { describe, expect, it } from 'vitest';
import {
  newChannel,
  newFormatBuild,
  newRxGroupList,
  newTalkGroup,
} from '@core/domain/factories.ts';
import { assemble } from '@core/services/assemble.ts';
import type { ChannelModeProfileDMR } from '@core/models/library.ts';
import { expandAllDm32ChannelsForExport, expandDm32ChannelWireRows } from './channelExpansion.ts';

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

describe('dm32 channelExpansion', () => {
  it('appends one scratch row per expanded repeater when enabled', () => {
    const tg = newTalkGroup(PROJECT_ID, 'Scotland', 950);
    const rgl = {
      ...newRxGroupList(PROJECT_ID, 'Scotland'),
      members: [{ ref: { kind: 'talkGroup' as const, id: tg.id } }],
    };
    const channel = dmrRepeaterChannel('Glasgow', rgl.id);
    const build = newFormatBuild(PROJECT_ID, 'dm32-baofeng-dm32uv');
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

    const rows = expandDm32ChannelWireRows(
      assembledChannel,
      assembled,
      library,
      { expandRxGroupLists: true, exportScratchChannels: true, profileId: 'dm32-baofeng-dm32uv' },
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
    const tg = newTalkGroup(PROJECT_ID, 'Scotland', 950);
    const rgl = {
      ...newRxGroupList(PROJECT_ID, 'Scotland'),
      members: [{ ref: { kind: 'talkGroup' as const, id: tg.id } }],
    };
    const channel = dmrRepeaterChannel('Glasgow', rgl.id);
    const build = newFormatBuild(PROJECT_ID, 'dm32-baofeng-dm32uv');
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

    const rows = expandAllDm32ChannelsForExport(assembled, library, {
      expandRxGroupLists: false,
      exportScratchChannels: true,
      profileId: 'dm32-baofeng-dm32uv',
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
    const build = newFormatBuild(PROJECT_ID, 'dm32-baofeng-dm32uv');
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

    const rows = expandAllDm32ChannelsForExport(assembled, library, {
      expandRxGroupLists: true,
      exportScratchChannels: false,
      profileId: 'dm32-baofeng-dm32uv',
    });

    expect(rows.every((row) => row.rowKind === 'talkGroup')).toBe(true);
    expect(rows).toHaveLength(1);
  });

  it('drops a single projection when its key is excluded', () => {
    const tgA = newTalkGroup(PROJECT_ID, 'Scotland', 950);
    const tgB = newTalkGroup(PROJECT_ID, 'England', 2350);
    const rgl = {
      ...newRxGroupList(PROJECT_ID, 'UK'),
      members: [
        { ref: { kind: 'talkGroup' as const, id: tgA.id } },
        { ref: { kind: 'talkGroup' as const, id: tgB.id } },
      ],
    };
    const channel = dmrRepeaterChannel('Glasgow', rgl.id);
    const build = newFormatBuild(PROJECT_ID, 'dm32-baofeng-dm32uv');
    const library = {
      channels: [channel],
      zones: [],
      talkGroups: [tgA, tgB],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [rgl],
      scanLists: [],
    };
    const assembled = assemble(build, library);
    const all = expandAllDm32ChannelsForExport(assembled, library, {
      expandRxGroupLists: true,
      exportScratchChannels: false,
      profileId: 'dm32-baofeng-dm32uv',
    });
    expect(all.length).toBeGreaterThanOrEqual(2);
    const skipKey = all[0]!.key;

    const filtered = expandAllDm32ChannelsForExport(assembled, library, {
      expandRxGroupLists: true,
      exportScratchChannels: false,
      profileId: 'dm32-baofeng-dm32uv',
      channelOverrides: [{ libraryEntityId: skipKey, excluded: true }],
    });
    expect(filtered).toHaveLength(all.length - 1);
    expect(filtered.every((row) => row.key !== skipKey)).toBe(true);

    const parentSkip = expandAllDm32ChannelsForExport(assembled, library, {
      expandRxGroupLists: true,
      exportScratchChannels: false,
      profileId: 'dm32-baofeng-dm32uv',
      channelOverrides: [{ libraryEntityId: channel.id, excluded: true }],
    });
    expect(parentSkip).toHaveLength(0);
  });
});
