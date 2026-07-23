import { describe, expect, it } from 'vitest';
import {
  newChannel,
  newRadioBuildForProfile,
  newRxGroupList,
  newTalkGroup,
} from '@core/domain/factories.ts';
import { assemble, type AssembledChannel, type LibrarySlice } from '@core/services/assemble.ts';
import type { ChannelModeProfileDMR } from '@core/models/library.ts';
import { expandAllMxNChannels } from '@core/import-export/channelExpansion/mxnExpandAll.ts';
import {
  assembledChannelsToRadioDtos,
  expandAssembledChannelsToRadioDtos,
} from './radioIoChannelMap.ts';

describe('assembledChannelsToRadioDtos', () => {
  it('maps wire name, slot, Hz, and NFM bandwidth', () => {
    const projectId = 'p1';
    const { build, egress } = newRadioBuildForProfile(projectId, 'radio-io-uv5r-mini');
    const entity = {
      ...newChannel(projectId, 'Library Name'),
      id: 'ch-1',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      power: 20,
      modeProfiles: [
        {
          mode: 'fm' as const,
          squelch: null,
          rxTone: '88.5',
          txTone: 'none',
          bandwidthKHz: 12.5,
        },
      ],
    };
    const row: AssembledChannel = {
      entity,
      wireName: 'WIRE12',
      wireNameOverride: 'WIRE12',
      orderOrSlot: 7,
    };
    const dtos = assembledChannelsToRadioDtos([row], build, egress);
    expect(dtos).toHaveLength(1);
    expect(dtos[0]).toMatchObject({
      slotIndex: 7,
      wireName: 'WIRE12',
      rxHz: 145_500_000,
      powerPercent: 20,
      bandwidth: 'NFM',
      rxTone: { kind: 'ctcss', hz: 88.5 },
    });
  });

  it('shortens long names to the radio-io profile nameLimit', () => {
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-uv5r-mini');
    const entity = {
      ...newChannel('p1', 'Very Long Channel Name Indeed'),
      id: 'ch-long',
      rxFrequency: 145_000_000,
      txFrequency: 145_000_000,
      modeProfiles: [
        { mode: 'fm' as const, squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 25 },
      ],
    };
    const row: AssembledChannel = {
      entity,
      wireName: 'Very Long Channel Name Indeed',
    };
    const dtos = assembledChannelsToRadioDtos([row], build, egress);
    expect(dtos[0]?.wireName.length).toBeLessThanOrEqual(12);
  });

  it('skips channels without RX frequency', () => {
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-uv5r-mini');
    const entity = {
      ...newChannel('p1', 'Empty'),
      id: 'ch-2',
      rxFrequency: null,
      modeProfiles: [],
    };
    expect(assembledChannelsToRadioDtos([{ entity, wireName: 'X' }], build, egress)).toEqual([]);
  });
});

describe('expandAssembledChannelsToRadioDtos — MxN', () => {
  const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

  function dmrLibrary(): {
    channel: ReturnType<typeof newChannel>;
    library: LibrarySlice;
  } {
    const tg1 = newTalkGroup(PROJECT_ID, 'Scotland', 950);
    const tg2 = newTalkGroup(PROJECT_ID, 'Local', 9);
    const rgl = {
      ...newRxGroupList(PROJECT_ID, 'Scotland'),
      members: [
        { ref: { kind: 'talkGroup' as const, id: tg1.id } },
        { ref: { kind: 'talkGroup' as const, id: tg2.id } },
      ],
    };
    const channel = {
      ...newChannel(PROJECT_ID, 'Glasgow'),
      callsign: 'GB7GL',
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
      modeProfiles: [
        {
          mode: 'dmr',
          colourCode: 1,
          timeslot: 1,
          dmrId: 1234567,
          contactRef: null,
          rxGroupListId: rgl.id,
        } satisfies ChannelModeProfileDMR,
      ],
    };
    return {
      channel,
      library: {
        channels: [channel],
        zones: [],
        talkGroups: [tg1, tg2],
        digitalContacts: [],
        analogContacts: [],
        rxGroupLists: [rgl],
        scanLists: [],
      },
    };
  }

  it('expands to the same wire names as expandAllMxNChannels when MxN is on', () => {
    const { channel, library } = dmrLibrary();
    const { build, egress } = newRadioBuildForProfile(PROJECT_ID, 'radio-io-dm32uv');
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const expected = expandAllMxNChannels({
      assembled,
      library,
      radioTargetId: build.radioTargetId,
      options: {
        expandRxGroupLists: true,
        exportScratchChannels: true,
        profileId: egress.profileId,
      },
    });
    const { dtos } = expandAssembledChannelsToRadioDtos(assembled, build, library, egress);
    expect(dtos.map((d) => d.wireName)).toEqual(expected.map((row) => row.wireName));
    expect(dtos.length).toBeGreaterThan(1);
    expect(channel.id).toBe(assembled.channels[0]?.entity.id);
  });

  it('stays lean 1:1 when expandRxGroupLists is off', () => {
    const { library } = dmrLibrary();
    const { build, egress } = newRadioBuildForProfile(PROJECT_ID, 'radio-io-dm32uv');
    const buildOff = {
      ...build,
      exportSettings: { ...build.exportSettings, expandRxGroupLists: false },
    };
    const assembled = assemble(buildOff, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const { dtos } = expandAssembledChannelsToRadioDtos(assembled, buildOff, library, egress);
    expect(dtos).toHaveLength(1);
  });

  it('does not fan out for non-MxN radio-io (UV-5R Mini)', () => {
    const projectId = 'p1';
    const { build, egress } = newRadioBuildForProfile(projectId, 'radio-io-uv5r-mini');
    const entity = {
      ...newChannel(projectId, 'Simple'),
      id: 'ch-1',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      modeProfiles: [
        { mode: 'fm' as const, squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 25 },
      ],
    };
    const library: LibrarySlice = {
      channels: [entity],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const { dtos } = expandAssembledChannelsToRadioDtos(assembled, build, library, egress);
    expect(dtos).toHaveLength(1);
  });
});
