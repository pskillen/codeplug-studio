import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { newChannel, newDigitalContact, newFormatBuild, newScanList, newTalkGroup } from '@core/domain/factories.ts';
import { parseProjectDocument } from '@core/import-export/formats/native-yaml/parse.ts';
import { assemble, exportInclusionWarnings } from './assemble.ts';
import { exportBuildAll } from './exportBuild.ts';

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
      scanLists: [],
    };

    const projection = assemble(build, library);

    expect(projection.profileId).toBe('opengd77-1701');
    expect(projection.channels).toHaveLength(2);
    expect(projection.channels[0]?.wireName).toBe('GB3DA Demo');
    expect(projection.channels[1]?.wireName).toBe('GB7GL Scot');

    expect(projection.zones).toHaveLength(1);
    expect(projection.zones[0]?.wireName).toBe('Edinburgh');
    expect(projection.zones[0]?.memberChannelIds).toEqual(['22222222-2222-4222-8222-222222222222']);

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
      scanLists: [],
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
      scanLists: [],
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
      scanLists: [],
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
      scanLists: [],
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
      scanLists: [],
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
      scanLists: [],
    };

    const projection = assemble(build, library);
    expect(projection.talkGroups.map((row) => row.entity.id)).not.toContain(orphanTalkGroup.id);
    expect(projection.talkGroups).toHaveLength(1);
  });

  it('includes unlinked digital contacts when exportUnlinkedDigitalContacts is true (default)', () => {
    const projectId = 'proj-orphan-contact';
    const orphanContact = newDigitalContact(projectId, 'Orphan User', 9999999);
    const build = newFormatBuild(projectId, 'anytone-at-d890uv');
    const library = {
      channels: [],
      zones: [],
      talkGroups: [],
      digitalContacts: [orphanContact],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };

    const projection = assemble(build, library);
    expect(projection.digitalContacts.map((row) => row.entity.id)).toContain(orphanContact.id);
  });

  it('excludes unlinked digital contacts when exportUnlinkedDigitalContacts is false', () => {
    const projectId = 'proj-orphan-contact-off';
    const orphanContact = newDigitalContact(projectId, 'Orphan User', 9999999);
    const build = {
      ...newFormatBuild(projectId, 'anytone-at-d890uv'),
      exportUnlinkedDigitalContacts: false,
    };
    const library = {
      channels: [],
      zones: [],
      talkGroups: [],
      digitalContacts: [orphanContact],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };

    const projection = assemble(build, library);
    expect(projection.digitalContacts.map((row) => row.entity.id)).not.toContain(orphanContact.id);
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
      scanLists: [],
    };

    const projection = assemble(build, library);
    expect(projection.channels.map((row) => row.entity.id)).not.toContain(orphanChannel.id);
    expect(projection.channels).toHaveLength(1);
    expect(projection.channels[0]?.entity.id).toBe('22222222-2222-4222-8222-222222222222');
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
      scanLists: [],
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
      scanListOverrides: [],
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
      scanLists: [],
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
      scanListOverrides: [],
    };

    const projection = assemble(build, library);
    const glasgow = projection.zones.find((z) => z.zoneId === parentZone.id);
    expect(glasgow?.memberChannelIds).toEqual([direct.id, child.id]);
  });

  it('omits nested-only zones from export but flattens into parent', () => {
    const projectId = 'proj-omit';
    const pmr = {
      ...newChannel(projectId, 'PMR ch'),
      id: 'ch-pmr',
    };
    const glasgowCh = {
      ...newChannel(projectId, 'Glasgow ch'),
      id: 'ch-glasgow',
    };
    const pmrZone = {
      id: 'zone-pmr',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'PMR446',
      comment: '',
      omitFromExport: true,
      members: [{ kind: 'channel' as const, channelId: pmr.id }],
    };
    const glasgowZone = {
      id: 'zone-glasgow',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'Glasgow',
      comment: '',
      members: [
        { kind: 'channel' as const, channelId: glasgowCh.id },
        { kind: 'zone' as const, zoneId: pmrZone.id },
      ],
    };
    const library = {
      channels: [pmr, glasgowCh],
      zones: [pmrZone, glasgowZone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
    const build = {
      id: 'build-omit',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'Omit test',
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
      scanListOverrides: [],
    };

    const projection = assemble(build, library);
    expect(projection.zones.map((z) => z.zoneId)).toEqual([glasgowZone.id]);
    const glasgow = projection.zones.find((z) => z.zoneId === glasgowZone.id);
    expect(glasgow?.memberChannelIds).toEqual([glasgowCh.id, pmr.id]);
  });

  it('excludes channels from standalone omitFromExport zones not nested in a parent', () => {
    const projectId = 'proj-omit-orphan';
    const pmr = {
      ...newChannel(projectId, 'PMR ch'),
      id: 'ch-pmr',
    };
    const other = {
      ...newChannel(projectId, 'Other ch'),
      id: 'ch-other',
    };
    const pmrZone = {
      id: 'zone-pmr',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'PMR446',
      comment: '',
      omitFromExport: true,
      members: [{ kind: 'channel' as const, channelId: pmr.id }],
    };
    const glasgowZone = {
      id: 'zone-glasgow',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'Glasgow',
      comment: '',
      members: [{ kind: 'channel' as const, channelId: other.id }],
    };
    const library = {
      channels: [pmr, other],
      zones: [pmrZone, glasgowZone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
    const build = {
      id: 'build-omit-orphan',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'Omit orphan test',
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
      scanListOverrides: [],
    };

    const projection = assemble(build, library);
    expect(projection.zones.map((z) => z.zoneId)).toEqual([glasgowZone.id]);
    expect(projection.channels.map((c) => c.entity.id)).toEqual([other.id]);
    expect(projection.channels.some((c) => c.entity.id === pmr.id)).toBe(false);
  });

  it('exports nested omitFromExport zone when forceInclude override is set', () => {
    const projectId = 'proj-force-include-nested';
    const pmr = {
      ...newChannel(projectId, 'PMR ch'),
      id: 'ch-pmr',
    };
    const glasgowCh = {
      ...newChannel(projectId, 'Glasgow ch'),
      id: 'ch-glasgow',
    };
    const pmrZone = {
      id: 'zone-pmr',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'PMR446',
      comment: '',
      omitFromExport: true,
      members: [{ kind: 'channel' as const, channelId: pmr.id }],
    };
    const glasgowZone = {
      id: 'zone-glasgow',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'Glasgow',
      comment: '',
      members: [
        { kind: 'channel' as const, channelId: glasgowCh.id },
        { kind: 'zone' as const, zoneId: pmrZone.id },
      ],
    };
    const library = {
      channels: [pmr, glasgowCh],
      zones: [pmrZone, glasgowZone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
    const build = {
      id: 'build-force-include',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'Force include test',
      formatId: 'opengd77',
      profileId: 'opengd77-1701',
      layout: { sections: [] },
      channelOverrides: [],
      zoneOverrides: [{ libraryEntityId: pmrZone.id, forceInclude: true }],
      talkGroupOverrides: [],
      rxGroupListOverrides: [],
      channelSelections: [],
      talkGroupSelections: [],
      rxGroupListSelections: [],
      digitalContactSelections: [],
      analogContactSelections: [],
      contactOverrides: [],
      scanListOverrides: [],
    };

    const projection = assemble(build, library);
    expect(projection.zones.map((z) => z.zoneId).sort()).toEqual(
      [glasgowZone.id, pmrZone.id].sort(),
    );
    const glasgow = projection.zones.find((z) => z.zoneId === glasgowZone.id);
    expect(glasgow?.memberChannelIds).toEqual([glasgowCh.id, pmr.id]);
  });

  it('exports channels from standalone omitFromExport zone when forceInclude is set', () => {
    const projectId = 'proj-force-include-orphan';
    const pmr = {
      ...newChannel(projectId, 'PMR ch'),
      id: 'ch-pmr',
    };
    const pmrZone = {
      id: 'zone-pmr',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'PMR446',
      comment: '',
      omitFromExport: true,
      members: [{ kind: 'channel' as const, channelId: pmr.id }],
    };
    const library = {
      channels: [pmr],
      zones: [pmrZone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
    const build = {
      id: 'build-force-include-orphan',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'Force include orphan test',
      formatId: 'opengd77',
      profileId: 'opengd77-1701',
      layout: { sections: [] },
      channelOverrides: [],
      zoneOverrides: [{ libraryEntityId: pmrZone.id, forceInclude: true }],
      talkGroupOverrides: [],
      rxGroupListOverrides: [],
      channelSelections: [],
      talkGroupSelections: [],
      rxGroupListSelections: [],
      digitalContactSelections: [],
      analogContactSelections: [],
      contactOverrides: [],
      scanListOverrides: [],
    };

    const projection = assemble(build, library);
    expect(projection.zones.map((z) => z.zoneId)).toEqual([pmrZone.id]);
    expect(projection.channels.map((c) => c.entity.id)).toEqual([pmr.id]);
  });

  it('excluded override wins over forceInclude on zones', () => {
    const projectId = 'proj-excluded-wins';
    const pmr = {
      ...newChannel(projectId, 'PMR ch'),
      id: 'ch-pmr',
    };
    const pmrZone = {
      id: 'zone-pmr',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'PMR446',
      comment: '',
      omitFromExport: true,
      members: [{ kind: 'channel' as const, channelId: pmr.id }],
    };
    const library = {
      channels: [pmr],
      zones: [pmrZone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
    const build = {
      id: 'build-excluded-wins',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'Excluded wins test',
      formatId: 'opengd77',
      profileId: 'opengd77-1701',
      layout: { sections: [] },
      channelOverrides: [],
      zoneOverrides: [{ libraryEntityId: pmrZone.id, forceInclude: true, excluded: true }],
      talkGroupOverrides: [],
      rxGroupListOverrides: [],
      channelSelections: [],
      talkGroupSelections: [],
      rxGroupListSelections: [],
      digitalContactSelections: [],
      analogContactSelections: [],
      contactOverrides: [],
      scanListOverrides: [],
    };

    const projection = assemble(build, library);
    expect(projection.zones).toEqual([]);
    expect(projection.channels).toEqual([]);
  });

  it('projects flat memory order for CHIRP builds', () => {
    const projectId = '11111111-1111-4111-8111-111111111111';
    const fmProfile = {
      mode: 'fm' as const,
      rxTone: 'none' as const,
      txTone: 'none' as const,
      squelch: null,
      bandwidthKHz: 12.5,
    };
    const ch1 = {
      ...newChannel(projectId, 'VHF'),
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      modeProfiles: [fmProfile],
    };
    const ch2 = {
      ...newChannel(projectId, 'UHF'),
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      modeProfiles: [fmProfile],
    };
    const library = {
      channels: [ch1, ch2],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
    const build = {
      id: 'build-chirp',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'CHIRP test',
      formatId: 'chirp',
      profileId: 'chirp-uv5r',
      layout: {
        sections: [
          {
            kind: 'flatMemory' as const,
            channelIds: [ch2.id, ch1.id],
            scanFlags: {},
          },
        ],
      },
      channelOverrides: [],
      zoneOverrides: [],
      talkGroupOverrides: [],
      rxGroupListOverrides: [],
      contactOverrides: [],
      scanListOverrides: [],
    };

    const projection = assemble(build, library);
    expect(projection.channelMemorySlots?.map((slot) => slot.channelId)).toEqual([ch2.id, ch1.id]);
    expect(projection.channels.map((c) => c.entity.id).sort()).toEqual([ch1.id, ch2.id]);
    expect(projection.zones).toEqual([]);
  });

  it('projects dedicated scan lists and channel scan list wire names', () => {
    const projectId = 'project-1';
    const scanListId = 'scan-list-1';
    const ch1 = { ...newChannel(projectId, 'Channel 1'), scanListId };
    const ch2 = newChannel(projectId, 'Channel 2');
    const scanList = {
      ...newScanList(projectId, 'Zone A SCL'),
      id: scanListId,
      memberChannelIds: [ch1.id, ch2.id],
    };
    const build = newFormatBuild('project-1', 'anytone-at-d890uv');
    const library = {
      channels: [ch1, ch2],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [scanList],
    };

    const projection = assemble(build, library);

    expect(projection.scanLists).toHaveLength(1);
    expect(projection.scanLists[0]?.wireName).toBe('Zone A SCL');
    expect(projection.scanLists[0]?.memberChannelIds).toEqual([ch1.id, ch2.id]);
    const ch1Row = projection.channels.find((row) => row.entity.id === ch1.id);
    const ch2Row = projection.channels.find((row) => row.entity.id === ch2.id);
    expect(ch1Row?.scanListWireName).toBe('Zone A SCL');
    expect(ch2Row?.scanListWireName).toBe('None');
  });

  it('assembles cyclic nested zones with partial flatten and export warnings', () => {
    const projectId = 'proj-cycle';
    const pmrChannel = { ...newChannel(projectId, 'PMR ch'), id: 'ch-pmr' };
    const glasgowChannel = { ...newChannel(projectId, 'Glasgow ch'), id: 'ch-g' };
    const pmrZone = {
      id: 'zone-pmr',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'PMR446',
      comment: '',
      members: [
        { kind: 'channel' as const, channelId: pmrChannel.id },
        { kind: 'zone' as const, zoneId: 'zone-glasgow' },
      ],
    };
    const glasgowZone = {
      id: 'zone-glasgow',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'Glasgow',
      comment: '',
      members: [
        { kind: 'channel' as const, channelId: glasgowChannel.id },
        { kind: 'zone' as const, zoneId: pmrZone.id },
      ],
    };
    const library = {
      channels: [pmrChannel, glasgowChannel],
      zones: [glasgowZone, pmrZone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
    const build = newFormatBuild(projectId, 'opengd77-1701');

    const projection = assemble(build, library);
    const glasgow = projection.zones.find((zone) => zone.zoneId === glasgowZone.id);
    expect(glasgow?.memberChannelIds).toEqual([glasgowChannel.id, pmrChannel.id]);

    const warnings = exportInclusionWarnings(build, library, projection);
    expect(warnings.some((warning) => warning.includes('cycle'))).toBe(true);

    const exportResult = exportBuildAll({ build, library });
    expect(exportResult.warnings.some((warning) => warning.includes('cycle'))).toBe(true);
    expect(Object.keys(exportResult.files).length).toBeGreaterThan(0);
  });

  it('resolves library APRS configuration and warns when channels need config', () => {
    const projectId = 'p-aprs';
    const config = {
      ...newFormatBuild(projectId, 'anytone-at-d890uv'),
      id: 'build-aprs',
    };
    const aprsConfig = {
      id: 'aprs-1',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'Home',
      comment: '',
      manualTxIntervalSec: 60,
      autoTxIntervalSec: 300,
      positionSource: 'gps' as const,
      fixedLocation: null,
      channelSlots: [],
    };
    const library = {
      channels: [],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
      aprsConfiguration: aprsConfig,
    };

    const assembled = assemble(config, library);
    expect(assembled.aprsConfiguration?.id).toBe(aprsConfig.id);

    const libraryWithoutConfig = { ...library, aprsConfiguration: null };
    const channelWithDigitalAprs = {
      ...newChannel(projectId, 'DMR'),
      modeProfiles: [
        {
          mode: 'dmr' as const,
          colourCode: 1,
          timeslot: 1 as const,
          dmrId: 1,
          dmrMode: null,
          contactRef: null,
          rxGroupListId: null,
        },
      ],
      aprs: {
        receiveEnabled: true,
        reportType: 'digital' as const,
        digitalPttMode: 'on' as const,
        reportSlotIndex: 1,
      },
    } satisfies Parameters<typeof assemble>[1]['channels'][number];
    const withoutConfig = assemble(config, {
      ...libraryWithoutConfig,
      channels: [channelWithDigitalAprs],
    });
    expect(withoutConfig.aprsConfiguration).toBeNull();
    expect(
      exportInclusionWarnings(
        config,
        { ...libraryWithoutConfig, channels: [channelWithDigitalAprs] },
        withoutConfig,
      ).some((w) => w.includes('no APRS configuration')),
    ).toBe(true);
  });
});
