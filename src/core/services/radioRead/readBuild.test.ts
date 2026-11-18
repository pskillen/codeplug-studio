import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import { describe, expect, it } from 'vitest';
import {
  emptyLibrary,
  newChannel,
  newRadioBuildWithEgresses,
  newZone,
} from '@core/domain/factories.ts';
import { assemble, librarySliceFrom } from '@core/services/assemble.ts';
import { planReadBuild, selectReadBuild } from './readBuild.ts';

const flat = () => newRadioBuildWithEgresses('p', 'baofeng-uv5r-mini').build;
const zoned = () => newRadioBuildWithEgresses('p', 'baofeng-uv5r-mini-mm9pdy').build;

describe('read build pruning', () => {
  it('keeps only radio channels and restores excluded channels on a flat build', () => {
    const [a, b, c] = ['A', 'B', 'C'].map((name) => ({
      ...newChannel('p', name),
      rxFrequency: 145_500_000,
      primaryMode: 'fm' as const,
      modeProfiles: [defaultModeProfile('fm')],
    }));
    const library = librarySliceFrom({ ...emptyLibrary(), channels: [a, b, c] });
    const build = { ...flat(), channelOverrides: [{ libraryEntityId: a.id, excluded: true }] };
    const input = {
      build,
      library,
      slotToChannelId: new Map([
        [1, a.id],
        [3, c.id],
      ]),
      zones: [],
    };
    const planned = planReadBuild(input);
    const assembled = assemble(planned.build, library);
    expect(assembled.channels.map((channel) => channel.entity.id)).toEqual([a.id, c.id]);
    expect(assembled.channelMemorySlots?.map((slot) => slot.channelId)).toEqual([a.id, null, c.id]);
    expect(library.channels).toContain(b);
    expect(planned.summary.channelsLeftOut).toBe(1);
    const again = planReadBuild({ ...input, build: planned.build });
    expect(again.build).toEqual(planned.build);
    expect(again.summary.channelsLeftOut).toBe(0);
  });

  it('excludes unread zones and channels without losing radio channels in excluded zones', () => {
    const [a, b, c, d] = ['A', 'B', 'C', 'D'].map((name) => ({
      ...newChannel('p', name),
      rxFrequency: 145_500_000,
      primaryMode: 'fm' as const,
      modeProfiles: [defaultModeProfile('fm')],
    }));
    const z1 = {
      ...newZone('p', 'Z1'),
      members: [a, b].map((channel) => ({ kind: 'channel' as const, channelId: channel.id })),
    };
    const z2 = { ...newZone('p', 'Z2'), members: [{ kind: 'channel' as const, channelId: a.id }] };
    const library = librarySliceFrom({
      ...emptyLibrary(),
      channels: [a, b, c, d],
      zones: [z1, z2],
    });
    const planned = planReadBuild({
      build: zoned(),
      library,
      slotToChannelId: new Map([
        [1, a.id],
        [2, b.id],
        [3, c.id],
      ]),
      zones: [{ zoneId: z1.id, name: z1.name, channelIds: [a.id, b.id] }],
    });
    const assembled = assemble(planned.build, library);
    expect(assembled.zones.map((zone) => zone.zoneId)).toEqual([z1.id]);
    expect(assembled.channels.map((channel) => channel.entity.id).sort()).toEqual(
      [a.id, b.id, c.id].sort(),
    );
    expect(library.zones).toContain(z2);
    expect(library.channels).toContain(d);
    expect(planned.summary).toMatchObject({ channelsLeftOut: 1, zonesLeftOut: 1 });
  });
});

describe('read build selection and layout', () => {
  it('prefers a matching started build, otherwise the first target match', () => {
    const first = flat();
    const second = flat();
    const other = zoned();
    const builds = [other, first, second];
    expect(
      selectReadBuild({
        builds,
        radioTargetId: first.radioTargetId,
        startedFromBuildId: second.id,
      }),
    ).toBe(second);
    expect(
      selectReadBuild({ builds, radioTargetId: first.radioTargetId, startedFromBuildId: other.id }),
    ).toBe(first);
    expect(selectReadBuild({ builds, radioTargetId: 'missing' })).toBeNull();
  });

  it('orders zones and members, sets explicit scan choices, and preserves pins', () => {
    const channels = ['A', 'B', 'C'].map((name) => ({
      ...newChannel('p', name),
      rxFrequency: 145_500_000,
      primaryMode: 'fm' as const,
      modeProfiles: [defaultModeProfile('fm')],
    }));
    const [a, b, c] = channels;
    const z1 = {
      ...newZone('p', 'Z1'),
      members: [a, b].map((channel) => ({ kind: 'channel' as const, channelId: channel.id })),
    };
    const z2 = { ...newZone('p', 'Z2'), members: [{ kind: 'channel' as const, channelId: c.id }] };
    const library = librarySliceFrom({ ...emptyLibrary(), channels, zones: [z1, z2] });
    const build = { ...zoned(), channelOverrides: [{ libraryEntityId: a.id, orderOrSlot: 8 }] };
    const snapshot = structuredClone(build);
    const zones = [
      { zoneId: z2.id, name: z2.name, channelIds: [c.id] },
      { zoneId: z1.id, name: z1.name, channelIds: [b.id, a.id], scanChannelIds: [a.id] },
    ];
    const input = {
      build,
      library,
      slotToChannelId: new Map([
        [1, a.id],
        [2, b.id],
        [3, c.id],
      ]),
      zones,
    };
    const planned = planReadBuild(input);
    expect(build).toEqual(snapshot);
    expect(planned.build.channelOverrides).toEqual(build.channelOverrides);
    expect(planned.summary).toMatchObject({
      zonesOrdered: 2,
      scanSetsSet: 1,
      channelSlotsPinned: 0,
    });
    const assembled = assemble(planned.build, library);
    expect(assembled.zones.map((z) => [z.zoneId, z.memberChannelIds])).toEqual([
      [z2.id, [c.id]],
      [z1.id, [b.id, a.id]],
    ]);
    expect(assembled.zoneGrouping?.zones.find((z) => z.id === z1.id)?.scanMemberInclusion).toEqual({
      [a.id]: 'include',
      [b.id]: 'skip',
    });
    expect(planReadBuild({ ...input, build: planned.build }).build).toEqual(planned.build);
    const empty = planReadBuild({ ...input, zones: [] });
    expect(empty.build.zoneOverrides).toEqual(build.zoneOverrides);
    expect(empty.build.layout).toEqual(build.layout);
  });
});

it('clears old flat pins, ignores zones, and leaves zones untouched without zone information', () => {
  const a = {
    ...newChannel('p', 'A'),
    rxFrequency: 145_500_000,
    primaryMode: 'fm' as const,
    modeProfiles: [defaultModeProfile('fm')],
  };
  const b = {
    ...newChannel('p', 'B'),
    rxFrequency: 145_500_000,
    primaryMode: 'fm' as const,
    modeProfiles: [defaultModeProfile('fm')],
  };
  const zone = newZone('p', 'Zone');
  const library = librarySliceFrom({ ...emptyLibrary(), channels: [a, b], zones: [zone] });
  const build = { ...flat(), channelOverrides: [{ libraryEntityId: b.id, orderOrSlot: 9 }] };
  const planned = planReadBuild({
    build,
    library,
    slotToChannelId: new Map([[5, a.id]]),
    zones: [{ zoneId: zone.id, name: zone.name, channelIds: [a.id] }],
  });
  expect(planned.build.layout).toEqual(build.layout);
  expect(planned.build.zoneOverrides).toEqual(build.zoneOverrides);
  expect(planned.build.channelOverrides.find((o) => o.libraryEntityId === b.id)).toEqual({
    libraryEntityId: b.id,
    excluded: true,
  });
  expect(assemble(planned.build, library).channelMemorySlots?.[4]).toEqual({
    slot: 5,
    channelId: a.id,
  });
  const zoneBuild = zoned();
  const empty = planReadBuild({
    build: zoneBuild,
    library,
    slotToChannelId: new Map([[1, a.id]]),
    zones: [],
  });
  expect(empty.build.zoneOverrides).toEqual(zoneBuild.zoneOverrides);
  expect(empty.build.layout).toEqual(zoneBuild.layout);
  expect(empty.summary).toMatchObject({ zonesLeftOut: 0, channelsLeftOut: 1 });
});

it('retains a scan set when a read has no scan information', () => {
  const a = newChannel('p', 'A');
  const z = { ...newZone('p', 'Z'), members: [{ kind: 'channel' as const, channelId: a.id }] };
  const library = librarySliceFrom({ ...emptyLibrary(), channels: [a], zones: [z] });
  const build = {
    ...zoned(),
    layout: {
      sections: [
        {
          kind: 'zoneGrouping' as const,
          zones: [
            {
              id: z.id,
              name: z.name,
              channelIds: [a.id],
              scanMemberInclusion: { [a.id]: 'skip' as const },
            },
          ],
        },
      ],
    },
  };
  const result = planReadBuild({
    build,
    library,
    slotToChannelId: new Map([[1, a.id]]),
    zones: [{ zoneId: z.id, name: z.name, channelIds: [a.id] }],
  });
  expect(result.build.layout).toEqual(build.layout);
  expect(result.summary.scanSetsSet).toBe(0);
});
