import { describe, expect, it } from 'vitest';
import { emptyLibrary, newChannel, newRadioBuild, newTalkGroup, newZone } from './factories.ts';
import { pruneStaleBuildReferences } from './pruneStaleBuildReferences.ts';
import type { Library } from '../models/library.ts';
import { multiTalkGroupMemberWireKey } from '../import-export/channelExpansion/multiTalkGroup.ts';

const projectId = 'p1';

describe('pruneStaleBuildReferences', () => {
  const kept = newChannel(projectId, 'Kept');
  const zone = newZone(projectId, 'Home');
  const talkGroup = newTalkGroup(projectId, 'World', 91);
  const library: Library = {
    ...emptyLibrary(),
    channels: [kept],
    zones: [zone],
    talkGroups: [talkGroup],
  };

  it('returns the same build when every reference resolves', () => {
    const build = {
      ...newRadioBuild(projectId, 'baofeng-dm1701'),
      layout: {
        sections: [
          {
            kind: 'zoneGrouping' as const,
            zones: [{ id: zone.id, name: 'Home', channelIds: [kept.id] }],
          },
        ],
      },
      zoneOverrides: [{ libraryEntityId: zone.id, wireName: 'Home' }],
    };

    const result = pruneStaleBuildReferences(build, library);
    expect(result.build).toBe(build);
    expect(result.removed).toEqual([]);
  });

  it('drops missing zones, channels, scan flags and overrides', () => {
    const build = {
      ...newRadioBuild(projectId, 'baofeng-dm1701'),
      layout: {
        sections: [
          {
            kind: 'zoneGrouping' as const,
            zones: [
              { id: zone.id, name: 'Home', channelIds: [kept.id, 'gone-channel'] },
              { id: 'gone-zone', name: 'Old', channelIds: [kept.id] },
            ],
          },
          {
            kind: 'flatMemory' as const,
            channelIds: ['gone-channel', kept.id],
            scanFlags: { [kept.id]: true, 'gone-channel': false },
          },
          {
            kind: 'scanLists' as const,
            scanLists: [{ id: 'sl', name: 'Scan', channelIds: ['gone-channel'] }],
          },
        ],
      },
      channelOverrides: [
        { libraryEntityId: kept.id, wireName: 'K' },
        { libraryEntityId: 'gone-channel', wireName: 'G' },
        {
          libraryEntityId: multiTalkGroupMemberWireKey(kept.id, 'dmr', {
            kind: 'talkGroup',
            id: 'gone-tg',
          }),
          wireName: 'M',
        },
      ],
      zoneOverrides: [{ libraryEntityId: 'gone-zone', excluded: true }],
      talkGroupOverrides: [
        { libraryEntityId: talkGroup.id, wireName: 'World' },
        { libraryEntityId: 'gone-tg', wireName: 'Old' },
      ],
    };

    const { build: pruned, removed } = pruneStaleBuildReferences(build, library);

    expect(pruned.layout.sections).toEqual([
      { kind: 'zoneGrouping', zones: [{ id: zone.id, name: 'Home', channelIds: [kept.id] }] },
      { kind: 'flatMemory', channelIds: [kept.id], scanFlags: { [kept.id]: true } },
      { kind: 'scanLists', scanLists: [{ id: 'sl', name: 'Scan', channelIds: [] }] },
    ]);
    expect(pruned.channelOverrides).toEqual([{ libraryEntityId: kept.id, wireName: 'K' }]);
    expect(pruned.zoneOverrides).toEqual([]);
    expect(pruned.talkGroupOverrides).toEqual([
      { libraryEntityId: talkGroup.id, wireName: 'World' },
    ]);
    expect(removed).toContain('zone "Old" (gone-zone) from the zone layout');
    expect(removed).toContain('2 channel override(s)');
  });

  it('leaves malformed channel override keys for validation to report', () => {
    const build = {
      ...newRadioBuild(projectId, 'baofeng-dm1701'),
      channelOverrides: [{ libraryEntityId: 'a:b:c', wireName: 'X' }],
    };
    expect(pruneStaleBuildReferences(build, library).removed).toEqual([]);
  });
});
