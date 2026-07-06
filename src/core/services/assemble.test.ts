import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { newChannel, newTalkGroup } from '@core/domain/factories.ts';
import { parseProjectDocument } from '@core/import-export/formats/native-yaml/parse.ts';
import { assemble } from './assemble.ts';

const fixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../import-export/formats/native-yaml/__fixtures__/export',
);

describe('assemble', () => {
  it('projects channel wire names and zone layout from format build fixture', () => {
    const yaml = readFileSync(join(fixtureDir, 'with-format-build.yaml'), 'utf8');
    const aggregate = parseProjectDocument(yaml);
    const build = aggregate.formatBuilds[0]!;
    const library = {
      channels: aggregate.channels,
      zones: aggregate.zones,
      talkGroups: aggregate.talkGroups,
      digitalContacts: aggregate.digitalContacts,
      analogContacts: aggregate.analogContacts,
      rxGroupLists: aggregate.rxGroupLists,
    };

    const projection = assemble(build, library);

    expect(projection.profileId).toBe('opengd77-1701');
    expect(projection.channels).toHaveLength(2);
    expect(projection.channels[0]?.wireName).toBe('GB3DA Demo');
    expect(projection.channels[1]?.wireName).toBe('GB7GL Scot');

    expect(projection.zones).toHaveLength(1);
    expect(projection.zones[0]?.wireName).toBe('Edinburgh');
    expect(projection.zones[0]?.memberChannelIds).toEqual([
      '22222222-2222-4222-8222-222222222222',
    ]);

    expect(projection.talkGroups).toHaveLength(1);
    expect(projection.talkGroups[0]?.wireName).toBe('Scotland');
    expect(projection.digitalContacts).toHaveLength(1);
    expect(projection.digitalContacts[0]?.wireName).toBe('MM0HAM');
    expect(projection.rxGroupLists).toHaveLength(1);
    expect(projection.rxGroupLists[0]?.wireName).toBe('Scotland TG');
  });

  it('honours export-time profile override without mutating build', () => {
    const yaml = readFileSync(join(fixtureDir, 'with-format-build.yaml'), 'utf8');
    const aggregate = parseProjectDocument(yaml);
    const build = aggregate.formatBuilds[0]!;
    const library = {
      channels: aggregate.channels,
      zones: aggregate.zones,
      talkGroups: aggregate.talkGroups,
      digitalContacts: aggregate.digitalContacts,
      analogContacts: aggregate.analogContacts,
      rxGroupLists: aggregate.rxGroupLists,
    };

    const projection = assemble(build, library, { profileId: 'opengd77-md9600' });
    expect(projection.profileId).toBe('opengd77-md9600');
    expect(build.profileId).toBe('opengd77-1701');
  });

  it('excludes channels when channel override marks excluded', () => {
    const yaml = readFileSync(join(fixtureDir, 'with-format-build.yaml'), 'utf8');
    const aggregate = parseProjectDocument(yaml);
    const build = {
      ...aggregate.formatBuilds[0]!,
      channelOverrides: [
        {
          libraryEntityId: '33333333-3333-4333-8333-333333333333',
          excluded: true,
        },
      ],
    };
    const library = {
      channels: aggregate.channels,
      zones: aggregate.zones,
      talkGroups: aggregate.talkGroups,
      digitalContacts: aggregate.digitalContacts,
      analogContacts: aggregate.analogContacts,
      rxGroupLists: aggregate.rxGroupLists,
    };

    const projection = assemble(build, library);
    expect(projection.channels).toHaveLength(1);
    expect(projection.channels[0]?.entity.id).toBe('22222222-2222-4222-8222-222222222222');
  });

  it('prefers wireName override over the library display name', () => {
    const yaml = readFileSync(join(fixtureDir, 'with-format-build.yaml'), 'utf8');
    const aggregate = parseProjectDocument(yaml);
    const channelId = '22222222-2222-4222-8222-222222222222';
    const build = {
      ...aggregate.formatBuilds[0]!,
      channelOverrides: [{ libraryEntityId: channelId, wireName: 'Custom wire' }],
    };
    const library = {
      channels: aggregate.channels,
      zones: aggregate.zones,
      talkGroups: aggregate.talkGroups,
      digitalContacts: aggregate.digitalContacts,
      analogContacts: aggregate.analogContacts,
      rxGroupLists: aggregate.rxGroupLists,
    };

    const projection = assemble(build, library);
    expect(projection.channels[0]?.wireName).toBe('Custom wire');
  });

  it('composes default channel wire names from callsign and name', () => {
    const yaml = readFileSync(join(fixtureDir, 'with-format-build.yaml'), 'utf8');
    const aggregate = parseProjectDocument(yaml);
    const build = {
      ...aggregate.formatBuilds[0]!,
      channelOverrides: [],
    };
    const library = {
      channels: aggregate.channels,
      zones: aggregate.zones,
      talkGroups: aggregate.talkGroups,
      digitalContacts: aggregate.digitalContacts,
      analogContacts: aggregate.analogContacts,
      rxGroupLists: aggregate.rxGroupLists,
    };

    const projection = assemble(build, library);
    expect(projection.channels).toHaveLength(2);
    expect(projection.channels[0]?.wireName).toBe('GB3DA GB3DA Demo');
    expect(projection.channels[1]?.wireName).toBe('GB7GL DMR Scotland');
    expect(projection.channels[0]?.wireNameOverride).toBeUndefined();
  });

  it('includes unlinked talk groups when exportUnlinkedTalkGroups is true (default)', () => {
    const yaml = readFileSync(join(fixtureDir, 'with-format-build.yaml'), 'utf8');
    const aggregate = parseProjectDocument(yaml);
    const build = aggregate.formatBuilds[0]!;
    const orphanTalkGroup = newTalkGroup(aggregate.meta.id, 'Orphan TG', 9999);
    const library = {
      channels: aggregate.channels,
      zones: aggregate.zones,
      talkGroups: [...aggregate.talkGroups, orphanTalkGroup],
      digitalContacts: aggregate.digitalContacts,
      analogContacts: aggregate.analogContacts,
      rxGroupLists: aggregate.rxGroupLists,
    };

    const projection = assemble(build, library);
    expect(projection.talkGroups.map((row) => row.entity.id)).toContain(orphanTalkGroup.id);
  });

  it('excludes unlinked talk groups when exportUnlinkedTalkGroups is false', () => {
    const yaml = readFileSync(join(fixtureDir, 'with-format-build.yaml'), 'utf8');
    const aggregate = parseProjectDocument(yaml);
    const build = {
      ...aggregate.formatBuilds[0]!,
      exportUnlinkedTalkGroups: false,
    };
    const orphanTalkGroup = newTalkGroup(aggregate.meta.id, 'Orphan TG', 9999);
    const library = {
      channels: aggregate.channels,
      zones: aggregate.zones,
      talkGroups: [...aggregate.talkGroups, orphanTalkGroup],
      digitalContacts: aggregate.digitalContacts,
      analogContacts: aggregate.analogContacts,
      rxGroupLists: aggregate.rxGroupLists,
    };

    const projection = assemble(build, library);
    expect(projection.talkGroups.map((row) => row.entity.id)).not.toContain(orphanTalkGroup.id);
    expect(projection.talkGroups).toHaveLength(1);
  });

  it('excludes unzoned channels when exportUnlinkedChannels is false', () => {
    const yaml = readFileSync(join(fixtureDir, 'with-format-build.yaml'), 'utf8');
    const aggregate = parseProjectDocument(yaml);
    const build = {
      ...aggregate.formatBuilds[0]!,
      exportUnlinkedChannels: false,
      channelOverrides: [],
    };
    const orphanChannel = newChannel(aggregate.meta.id, 'Orphan', 'GB9ZZ');
    const library = {
      channels: [...aggregate.channels, orphanChannel],
      zones: aggregate.zones,
      talkGroups: aggregate.talkGroups,
      digitalContacts: aggregate.digitalContacts,
      analogContacts: aggregate.analogContacts,
      rxGroupLists: aggregate.rxGroupLists,
    };

    const projection = assemble(build, library);
    expect(projection.channels.map((row) => row.entity.id)).not.toContain(orphanChannel.id);
    expect(projection.channels).toHaveLength(2);
  });

  it('flattens nested library zones into assembled member channel ids', () => {
    const projectId = 'proj-nested';
    const child = {
      ...newChannel(projectId, 'Child ch'),
      id: 'ch-child',
    };
    const childZone = {
      id: 'zone-child',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'Child',
      comment: '',
      members: [{ kind: 'channel' as const, channelId: child.id }],
    };
    const parentZone = {
      id: 'zone-parent',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'Parent',
      comment: '',
      members: [{ kind: 'zone' as const, zoneId: childZone.id }],
    };
    const library = {
      channels: [child],
      zones: [childZone, parentZone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
    };
    const build = {
      id: 'build-1',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'Nested test',
      formatId: 'opengd77',
      profileId: 'opengd77-1701',
      layout: { sections: [] },
      channelOverrides: [],
      zoneOverrides: [],
      talkGroupOverrides: [],
      rxGroupListOverrides: [],
      channelSelections: [],
      talkGroupSelections: [],
      rxGroupListSelections: [],
      digitalContactSelections: [],
      analogContactSelections: [],
      contactOverrides: [],
    };

    const projection = assemble(build, library);
    const parent = projection.zones.find((z) => z.zoneId === parentZone.id);
    expect(parent?.memberChannelIds).toEqual([child.id]);
  });

  it('flattens nested zones when build has stale zoneGrouping channelIds', () => {
    const projectId = 'proj-nested-layout';
    const child = {
      ...newChannel(projectId, 'PMR ch'),
      id: 'ch-pmr',
    };
    const direct = {
      ...newChannel(projectId, 'Glasgow ch'),
      id: 'ch-glasgow',
    };
    const childZone = {
      id: 'zone-pmr',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'PMR446',
      comment: '',
      members: [{ kind: 'channel' as const, channelId: child.id }],
    };
    const parentZone = {
      id: 'zone-glasgow',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'Glasgow',
      comment: '',
      members: [
        { kind: 'channel' as const, channelId: direct.id },
        { kind: 'zone' as const, zoneId: childZone.id },
      ],
    };
    const library = {
      channels: [child, direct],
      zones: [childZone, parentZone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
    };
    const build = {
      id: 'build-layout',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'Nested layout test',
      formatId: 'dm32',
      profileId: 'dm32-baofeng-dm32uv',
      layout: {
        sections: [
          {
            kind: 'zoneGrouping' as const,
            zones: [
              {
                id: parentZone.id,
                name: parentZone.name,
                channelIds: [direct.id],
              },
              {
                id: childZone.id,
                name: childZone.name,
                channelIds: [child.id],
              },
            ],
          },
        ],
      },
      channelOverrides: [],
      zoneOverrides: [],
      talkGroupOverrides: [],
      rxGroupListOverrides: [],
      channelSelections: [],
      talkGroupSelections: [],
      rxGroupListSelections: [],
      digitalContactSelections: [],
      analogContactSelections: [],
      contactOverrides: [],
    };

    const projection = assemble(build, library);
    const glasgow = projection.zones.find((z) => z.zoneId === parentZone.id);
    expect(glasgow?.memberChannelIds).toEqual([direct.id, child.id]);
  });
});
