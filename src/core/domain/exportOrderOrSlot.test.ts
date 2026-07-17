import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import { newChannel } from '@core/domain/factories.ts';
import { newFormatBuild } from '@core/domain/factories.ts';
import {
  applyDenseChannelOrderOrSlots,
  chirpMemoryChannelIds,
  clearAllOrderOrSlots,
  hasAnyOrderOrSlotOverride,
  migrateFlatMemoryLayoutToOrderOrSlot,
  resolveChirpChannelMemorySlots,
} from './exportOrderOrSlot.ts';

describe('exportOrderOrSlot', () => {
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

  const emptyLibrary = {
    zones: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    scanLists: [],
  };

  it('includes all analogue channels densely when overrides are empty', () => {
    const ch = fmChannel('ch-1', 'A');
    const build = newFormatBuild(projectId, 'chirp-uv5r');
    const library = { ...emptyLibrary, channels: [ch] };
    expect(resolveChirpChannelMemorySlots(build, library)).toEqual([
      { slot: 1, channelId: 'ch-1' },
    ]);
    expect(chirpMemoryChannelIds(build, library)).toEqual(['ch-1']);
  });

  it('respects explicit orderOrSlot and leaves blank gaps', () => {
    const ch1 = fmChannel('ch-1', 'A');
    const ch2 = fmChannel('ch-2', 'B');
    const build = {
      ...newFormatBuild(projectId, 'chirp-uv5r'),
      channelOverrides: [
        { libraryEntityId: 'ch-1', orderOrSlot: 1 },
        { libraryEntityId: 'ch-2', orderOrSlot: 5 },
      ],
    };
    const library = { ...emptyLibrary, channels: [ch1, ch2] };
    expect(resolveChirpChannelMemorySlots(build, library)).toEqual([
      { slot: 1, channelId: 'ch-1' },
      { slot: 2, channelId: null },
      { slot: 3, channelId: null },
      { slot: 4, channelId: null },
      { slot: 5, channelId: 'ch-2' },
    ]);
    expect(chirpMemoryChannelIds(build, library)).toEqual(['ch-1', 'ch-2']);
  });

  it('places unordered channels after the highest explicit slot', () => {
    const ch1 = fmChannel('ch-1', 'A');
    const ch2 = fmChannel('ch-2', 'B');
    const ch3 = fmChannel('ch-3', 'C');
    const build = {
      ...newFormatBuild(projectId, 'chirp-uv5r'),
      channelOverrides: [{ libraryEntityId: 'ch-1', orderOrSlot: 1 }],
    };
    const library = { ...emptyLibrary, channels: [ch1, ch2, ch3] };
    expect(chirpMemoryChannelIds(build, library)).toEqual(['ch-1', 'ch-2', 'ch-3']);
    expect(resolveChirpChannelMemorySlots(build, library).map((row) => row.channelId)).toEqual([
      'ch-1',
      'ch-2',
      'ch-3',
    ]);
  });

  it('omits excluded and digital channels', () => {
    const analogue = fmChannel('ch-fm', 'FM');
    const digital: Channel = {
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
    const build = {
      ...newFormatBuild(projectId, 'chirp-uv5r'),
      channelOverrides: [{ libraryEntityId: 'ch-fm', excluded: true }],
    };
    const library = { ...emptyLibrary, channels: [analogue, digital] };
    expect(chirpMemoryChannelIds(build, library)).toEqual([]);
  });

  it('applyDenseChannelOrderOrSlots rewrites order fields', () => {
    const overrides = applyDenseChannelOrderOrSlots(
      [
        { libraryEntityId: 'a', orderOrSlot: 9 },
        { libraryEntityId: 'b', wireName: 'B' },
      ],
      ['b', 'a'],
    );
    expect(overrides).toEqual([
      { libraryEntityId: 'a', orderOrSlot: 2 },
      { libraryEntityId: 'b', wireName: 'B', orderOrSlot: 1 },
    ]);
  });

  it('migrates legacy flatMemory layout to orderOrSlot and exclusions', () => {
    const ch1 = fmChannel('ch-1', 'A');
    const ch2 = fmChannel('ch-2', 'B');
    const ch3 = fmChannel('ch-3', 'C');
    const build = {
      ...newFormatBuild(projectId, 'chirp-uv5r'),
      layout: {
        sections: [{ kind: 'flatMemory' as const, channelIds: ['ch-2', 'ch-1'], scanFlags: {} }],
      },
    };
    const library = { ...emptyLibrary, channels: [ch1, ch2, ch3] };
    const migrated = migrateFlatMemoryLayoutToOrderOrSlot(build, library);
    expect(migrated.layout.sections).toEqual([]);
    expect(chirpMemoryChannelIds(migrated, library)).toEqual(['ch-2', 'ch-1']);
    expect(migrated.channelOverrides.find((row) => row.libraryEntityId === 'ch-3')?.excluded).toBe(
      true,
    );
  });

  it('detects and clears orderOrSlot overrides', () => {
    expect(hasAnyOrderOrSlotOverride([])).toBe(false);
    expect(hasAnyOrderOrSlotOverride([{ libraryEntityId: 'a', wireName: 'A' }])).toBe(false);
    expect(hasAnyOrderOrSlotOverride([{ libraryEntityId: 'a', orderOrSlot: 1 }])).toBe(true);

    const cleared = clearAllOrderOrSlots([
      { libraryEntityId: 'a', orderOrSlot: 1 },
      { libraryEntityId: 'b', wireName: 'B', orderOrSlot: 2 },
      { libraryEntityId: 'c', excluded: true },
    ]);
    expect(cleared).toEqual([
      { libraryEntityId: 'b', wireName: 'B' },
      { libraryEntityId: 'c', excluded: true },
    ]);
    expect(hasAnyOrderOrSlotOverride(cleared)).toBe(false);
  });
});
