import { describe, expect, it } from 'vitest';
import { newChannel } from '@core/domain/factories.ts';
import { newFormatBuild } from '@core/domain/factories.ts';
import {
  flatMemoryExportChannelIds,
  reorderFlatMemoryChannels,
  resolveFlatMemorySection,
  seedFlatMemoryFromBuild,
} from './flatMemoryLayout.ts';

describe('flatMemoryLayout', () => {
  const projectId = '11111111-1111-4111-8111-111111111111';

  function fmChannel(id: string, name: string) {
    return {
      ...newChannel(projectId, name),
      id,
      modeProfiles: [
        {
          mode: 'fm' as const,
          rxTone: 'none' as const,
          txTone: 'none' as const,
          squelch: null,
          bandwidthKHz: 12.5,
        },
      ],
    };
  }

  it('seeds channel ids from library when layout empty', () => {
    const ch = fmChannel('ch-1', 'A');
    const build = newFormatBuild(projectId, 'chirp-uv5r');
    const library = {
      channels: [ch],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
    };
    const section = seedFlatMemoryFromBuild(build, library);
    expect(section.channelIds).toEqual(['ch-1']);
  });

  it('respects flat memory order for export', () => {
    const ch1 = fmChannel('ch-1', 'A');
    const ch2 = fmChannel('ch-2', 'B');
    const build = {
      ...newFormatBuild(projectId, 'chirp-uv5r'),
      layout: {
        sections: [{ kind: 'flatMemory' as const, channelIds: ['ch-2', 'ch-1'], scanFlags: {} }],
      },
    };
    const library = {
      channels: [ch1, ch2],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
    };
    expect(flatMemoryExportChannelIds(build, library)).toEqual(['ch-2', 'ch-1']);
    expect(resolveFlatMemorySection(build, library).channelIds).toEqual(['ch-2', 'ch-1']);
  });

  it('reorders channels in layout section', () => {
    const section = {
      kind: 'flatMemory' as const,
      channelIds: ['a', 'b'],
      scanFlags: {},
    };
    expect(reorderFlatMemoryChannels(section, ['b', 'a']).channelIds).toEqual(['b', 'a']);
  });

  it('omits digital channels from CHIRP flat memory seed and export', () => {
    const analogue = fmChannel('ch-fm', 'FM');
    const digital = {
      ...newChannel(projectId, 'DMR'),
      id: 'ch-dmr',
      modeProfiles: [
        {
          mode: 'dmr' as const,
          colourCode: 1,
          timeslot: 1 as const,
          dmrId: 123,
          contactRef: null,
          rxGroupListId: null,
        },
      ],
    };
    const build = newFormatBuild(projectId, 'chirp-uv5r');
    const library = {
      channels: [analogue, digital],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
    };
    expect(seedFlatMemoryFromBuild(build, library).channelIds).toEqual(['ch-fm']);
    const orderedBuild = {
      ...build,
      layout: {
        sections: [
          {
            kind: 'flatMemory' as const,
            channelIds: ['ch-fm', 'ch-dmr'],
            scanFlags: {},
          },
        ],
      },
    };
    expect(flatMemoryExportChannelIds(orderedBuild, library)).toEqual(['ch-fm']);
  });
});
