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

  it('seeds channel ids from library when layout empty', () => {
    const ch = { ...newChannel(projectId, 'A'), id: 'ch-1' };
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
    const ch1 = { ...newChannel(projectId, 'A'), id: 'ch-1' };
    const ch2 = { ...newChannel(projectId, 'B'), id: 'ch-2' };
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
});
