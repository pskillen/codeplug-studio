import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import { parseProjectDocument } from '@core/import-export/formats/native-yaml/parse.ts';
import {
  newChannel,
  newFormatBuild,
  newRxGroupList,
  newTalkGroup,
  newZone,
} from '@core/domain/factories.ts';
import {
  previewWireRows,
  includedPreviewWireRows,
  isPreviewRowIncludedInExport,
} from './previewWireRows.ts';

const fixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../import-export/formats/native-yaml/__fixtures__/export',
);

describe('previewWireRows', () => {
  it('shows channel display label and effective wire name from overrides', () => {
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

    const rows = previewWireRows(build, library, 'channel');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.displayLabel).toContain('GB3DA');
    expect(rows[0]?.effectiveWireName).toBe('GB3DA Demo');
    expect(rows[0]?.generatedWireName).toBe('GB3DA GB3DA Demo');
    expect(rows[0]?.hasWireNameOverride).toBe(true);
    expect(rows[1]?.effectiveWireName).toBe('GB7GL Scot');
    expect(rows[1]?.generatedWireName).toBe('GB7GL DMR Scot');
  });

  it('keeps talk group generated wire name separate from build override', () => {
    const yaml = readFileSync(join(fixtureDir, 'with-format-build.yaml'), 'utf8');
    const aggregate = parseProjectDocument(yaml);
    const tgId = '55555555-5555-4555-8555-555555555555';
    const build = {
      ...aggregate.formatBuilds[0]!,
      talkGroupOverrides: [{ libraryEntityId: tgId, wireName: 'Custom Override' }],
    };
    const library = {
      channels: aggregate.channels,
      zones: aggregate.zones,
      talkGroups: aggregate.talkGroups.map((talkGroup) =>
        talkGroup.id === tgId ? { ...talkGroup, name: 'Scotland Full Name' } : talkGroup,
      ),
      digitalContacts: aggregate.digitalContacts,
      analogContacts: aggregate.analogContacts,
      rxGroupLists: aggregate.rxGroupLists,
    };

    const rows = previewWireRows(build, library, 'talkGroup', { shortenNames: false });
    const row = rows.find((entry) => entry.libraryEntityId === tgId);
    expect(row?.generatedWireName).toBe('Scotland Full Name');
    expect(row?.effectiveWireName).toBe('Custom Override');
    expect(row?.hasWireNameOverride).toBe(true);
  });

  it('applies talk group abbreviation to generated wire name when override is set', () => {
    const yaml = readFileSync(join(fixtureDir, 'with-format-build.yaml'), 'utf8');
    const aggregate = parseProjectDocument(yaml);
    const tgId = '55555555-5555-4555-8555-555555555555';
    const build = {
      ...aggregate.formatBuilds[0]!,
      talkGroupOverrides: [{ libraryEntityId: tgId, wireName: 'Short override' }],
    };
    const library = {
      channels: aggregate.channels,
      zones: aggregate.zones,
      talkGroups: aggregate.talkGroups.map((talkGroup) =>
        talkGroup.id === tgId
          ? { ...talkGroup, name: 'Very Long Talk Group Name', abbreviation: 'VL TGN' }
          : talkGroup,
      ),
      digitalContacts: aggregate.digitalContacts,
      analogContacts: aggregate.analogContacts,
      rxGroupLists: aggregate.rxGroupLists,
    };

    const rows = previewWireRows(build, library, 'talkGroup', {
      profileId: build.profileId,
      shortenNames: true,
    });
    const row = rows.find((entry) => entry.libraryEntityId === tgId);
    expect(row?.generatedWireName).toBe('VL TGN');
    expect(row?.effectiveWireName).toBe('Short override');
  });

  it('marks excluded channels in preview rows', () => {
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

    const rows = previewWireRows(build, library, 'channel');
    const excluded = rows.find((row) => row.libraryEntityId.endsWith('3333'));
    expect(excluded?.excluded).toBe(true);
  });

  it('expands multi-mode channels into separate preview rows', () => {
    const yaml = readFileSync(join(fixtureDir, 'with-format-build.yaml'), 'utf8');
    const aggregate = parseProjectDocument(yaml);
    const build = aggregate.formatBuilds[0]!;
    const channels: Channel[] = aggregate.channels.map((channel, index) =>
      index === 1
        ? {
            ...channel,
            modeProfiles: [
              {
                mode: 'fm' as const,
                squelch: 50,
                rxTone: 'none' as const,
                txTone: 'none' as const,
                bandwidthKHz: 12.5,
              },
              {
                mode: 'dmr' as const,
                colourCode: 1,
                timeslot: 2 as const,
                dmrId: 123,
                contactRef: null,
                rxGroupListId: null,
              },
            ],
          }
        : channel,
    );
    const library = {
      channels,
      zones: aggregate.zones,
      talkGroups: aggregate.talkGroups,
      digitalContacts: aggregate.digitalContacts,
      analogContacts: aggregate.analogContacts,
      rxGroupLists: aggregate.rxGroupLists,
    };

    const rows = previewWireRows(build, library, 'channel', {
      profileId: build.profileId,
      expandModes: true,
    });
    const multiModeRows = rows.filter((row) => row.libraryEntityId === channels[1]!.id);
    expect(multiModeRows).toHaveLength(2);
    expect(multiModeRows[0]?.generatedWireName).toMatch(/-F$/);
    expect(multiModeRows[1]?.generatedWireName).toMatch(/-D$/);
    expect(multiModeRows[0]?.effectiveWireName).toBe('GB7GL Scot');
    expect(multiModeRows[1]?.effectiveWireName).toBe('GB7GL Scot');
  });

  it('shortens wire names at the profile name limit in preview', () => {
    const yaml = readFileSync(join(fixtureDir, 'with-format-build.yaml'), 'utf8');
    const aggregate = parseProjectDocument(yaml);
    const build = aggregate.formatBuilds[0]!;
    const channels = aggregate.channels.map((channel) => ({
      ...channel,
      name: 'Very Long Channel Name That Exceeds Limit',
      callsign: 'MM0HAM',
    }));
    const library = {
      channels,
      zones: aggregate.zones,
      talkGroups: aggregate.talkGroups,
      digitalContacts: aggregate.digitalContacts,
      analogContacts: aggregate.analogContacts,
      rxGroupLists: aggregate.rxGroupLists,
    };

    const rows = previewWireRows(build, library, 'channel', {
      profileId: build.profileId,
      shortenNames: true,
      maxNameLength: 16,
    });
    expect(rows[0]?.effectiveWireName.length).toBeLessThanOrEqual(16);
  });

  it('generates channel wire names from callsign and name when no override', () => {
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

    const rows = previewWireRows(build, library, 'channel', {
      profileId: build.profileId,
      shortenNames: false,
    });
    expect(rows.find((row) => row.libraryEntityId.endsWith('2222'))?.generatedWireName).toBe(
      'GB3DA GB3DA Demo',
    );
    expect(rows.find((row) => row.libraryEntityId.endsWith('3333'))?.generatedWireName).toBe(
      'GB7GL DMR Scotland',
    );
  });

  it('prefers channel abbreviation over vowel squeeze in preview', () => {
    const yaml = readFileSync(join(fixtureDir, 'with-format-build.yaml'), 'utf8');
    const aggregate = parseProjectDocument(yaml);
    const build = {
      ...aggregate.formatBuilds[0]!,
      channelOverrides: [],
    };
    const channels = aggregate.channels.map((channel, index) =>
      index === 1
        ? { ...channel, callsign: 'GB3MT', name: 'Mugherafelt', abbreviation: "M'flt" }
        : channel,
    );
    const library = {
      channels,
      zones: aggregate.zones,
      talkGroups: aggregate.talkGroups,
      digitalContacts: aggregate.digitalContacts,
      analogContacts: aggregate.analogContacts,
      rxGroupLists: aggregate.rxGroupLists,
    };

    const rows = previewWireRows(build, library, 'channel', {
      profileId: build.profileId,
      shortenNames: true,
    });
    const row = rows.find((r) => r.libraryEntityId === channels[1]!.id);
    expect(row?.generatedWireName).toBe("GB3MT M'flt");
  });

  it('adds channel and talk group display details for DM32 RX-list fan-out rows', () => {
    const projectId = 'proj-dm32-preview';
    const tg1 = { ...newTalkGroup(projectId, 'Scotland', 2355), id: 'tg-scotland' };
    const tg2 = { ...newTalkGroup(projectId, 'Local', 9), id: 'tg-local' };
    const rgl = {
      ...newRxGroupList(projectId, 'Scotland'),
      id: 'rgl-scotland',
      members: [
        { ref: { kind: 'talkGroup' as const, id: tg1.id } },
        { ref: { kind: 'talkGroup' as const, id: tg2.id } },
      ],
    };
    const channel: Channel = {
      ...newChannel(projectId, 'GB7GL Repeater', 'GB7GL'),
      id: 'ch-gb7gl',
      rxFrequency: 430_850_000,
      txFrequency: 438_450_000,
      modeProfiles: [
        {
          mode: 'dmr',
          colourCode: 7,
          timeslot: 1,
          dmrId: null,
          contactRef: null,
          rxGroupListId: rgl.id,
        },
      ],
    };
    const build = newFormatBuild(projectId, 'dm32-baofeng-dm32uv', 'DM32 preview');
    const library = {
      channels: [channel],
      zones: [],
      talkGroups: [tg1, tg2],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [rgl],
    };

    const rows = previewWireRows(build, library, 'channel', { profileId: build.profileId });
    const fanOutRows = rows.filter((row) => row.displayDetails?.length);
    expect(fanOutRows).toHaveLength(2);
    expect(fanOutRows[0]?.displayDetails).toEqual([
      { label: 'Channel', value: 'GB7GL Repeater' },
      { label: 'Talk group', value: 'Scotland (2355) · Slot 1' },
    ]);
    expect(fanOutRows[1]?.displayDetails).toEqual([
      { label: 'Channel', value: 'GB7GL Repeater' },
      { label: 'Talk group', value: 'Local (9) · Slot 1' },
    ]);
  });

  it('keeps library-zoned channels when exportUnlinkedChannels is false', () => {
    const projectId = 'proj-zone-link';
    const zonedChannel = {
      ...newChannel(projectId, 'Zoned', 'GB3ZZ'),
      id: 'ch-zoned',
    };
    const orphanChannel = {
      ...newChannel(projectId, 'Orphan', 'GB9YY'),
      id: 'ch-orphan',
    };
    const zone = {
      id: 'zone-edinburgh',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'Edinburgh',
      comment: '',
      members: [{ kind: 'channel' as const, channelId: zonedChannel.id }],
    };
    const build = {
      ...newFormatBuild(projectId, 'opengd77-1701', 'Zone link test'),
      exportUnlinkedChannels: false,
      layout: { sections: [] },
    };
    const library = {
      channels: [zonedChannel, orphanChannel],
      zones: [zone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
    };

    const included = includedPreviewWireRows(build, library, 'channel');
    expect(included.map((row) => row.libraryEntityId)).toEqual([zonedChannel.id]);
  });

  it('keeps library-zoned channels with legacy zone member refs when exportUnlinkedChannels is false', () => {
    const projectId = 'proj-legacy-zone';
    const zonedChannel = {
      ...newChannel(projectId, 'Legacy zoned', 'GB3ZZ'),
      id: 'ch-legacy-zoned',
    };
    const zone = {
      id: 'zone-legacy',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'Legacy zone',
      comment: '',
      members: [{ kind: 'channel' as const, channelId: zonedChannel.id }],
    };
    const build = {
      ...newFormatBuild(projectId, 'opengd77-1701', 'Legacy zone test'),
      exportUnlinkedChannels: false,
      layout: { sections: [] },
    };
    const library = {
      channels: [zonedChannel],
      zones: [zone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
    };

    const included = includedPreviewWireRows(build, library, 'channel');
    expect(included.map((row) => row.libraryEntityId)).toEqual([zonedChannel.id]);
  });

  it('wire preview hide toggle shows orphan channels when off and hides when on', () => {
    const projectId = 'proj-hide-toggle';
    const zonedChannel = {
      ...newChannel(projectId, 'Zoned', 'GB3ZZ'),
      id: 'ch-zoned',
    };
    const orphanChannel = {
      ...newChannel(projectId, 'Orphan', 'GB9YY'),
      id: 'ch-orphan',
    };
    const zone = {
      id: 'zone-edinburgh',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'Edinburgh',
      comment: '',
      members: [{ kind: 'channel' as const, channelId: zonedChannel.id }],
    };
    const build = {
      ...newFormatBuild(projectId, 'opengd77-1701', 'Hide toggle test'),
      exportUnlinkedChannels: false,
      layout: { sections: [] },
    };
    const library = {
      channels: [zonedChannel, orphanChannel],
      zones: [zone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
    };

    const allRows = previewWireRows(build, library, 'channel');
    const visibleWhenHidden = allRows.filter((row) =>
      isPreviewRowIncludedInExport(build, library, 'channel', row),
    );

    expect(allRows.map((row) => row.libraryEntityId).sort()).toEqual(['ch-orphan', 'ch-zoned']);
    expect(visibleWhenHidden.map((row) => row.libraryEntityId)).toEqual([zonedChannel.id]);
    expect(allRows.find((row) => row.libraryEntityId === orphanChannel.id)?.expansionNote).toBe(
      'Not linked to a zone',
    );
  });

  it('lists unlinked DM32 channels in preview so hide toggle can reveal them', () => {
    const projectId = 'proj-dm32-orphan';
    const zonedChannel = {
      ...newChannel(projectId, 'Zoned', 'GB3ZZ'),
      id: 'ch-zoned',
      modeProfiles: [
        {
          mode: 'fm' as const,
          squelch: 50,
          rxTone: 'none' as const,
          txTone: 'none' as const,
          bandwidthKHz: 12.5,
        },
      ],
    };
    const orphanChannel = {
      ...newChannel(projectId, 'Orphan', 'GB9YY'),
      id: 'ch-orphan',
      modeProfiles: [
        {
          mode: 'fm' as const,
          squelch: 50,
          rxTone: 'none' as const,
          txTone: 'none' as const,
          bandwidthKHz: 12.5,
        },
      ],
    };
    const zone = {
      id: 'zone-edinburgh',
      projectId,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'Edinburgh',
      comment: '',
      members: [{ kind: 'channel' as const, channelId: zonedChannel.id }],
    };
    const build = {
      ...newFormatBuild(projectId, 'dm32-baofeng-dm32uv', 'DM32 hide toggle'),
      exportUnlinkedChannels: false,
      layout: { sections: [] },
    };
    const library = {
      channels: [zonedChannel, orphanChannel],
      zones: [zone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
    };

    const allRows = previewWireRows(build, library, 'channel');
    expect(allRows.some((row) => row.libraryEntityId === orphanChannel.id)).toBe(true);
    expect(allRows.find((row) => row.libraryEntityId === orphanChannel.id)?.expansionNote).toBe(
      'Not linked to a zone',
    );
  });

  it('marks zones with omitFromExport and excludes them from export preview', () => {
    const projectId = 'proj-omit-zone-preview';
    const pmrChannel = {
      ...newChannel(projectId, 'PMR', 'GB3PMR'),
      id: 'ch-pmr',
    };
    const pmrZone = {
      ...newZone(projectId, 'PMR446'),
      id: 'zone-pmr',
      omitFromExport: true,
      members: [{ kind: 'channel' as const, channelId: pmrChannel.id }],
    };
    const glasgowZone = {
      ...newZone(projectId, 'Glasgow'),
      id: 'zone-glasgow',
      members: [{ kind: 'zone' as const, zoneId: pmrZone.id }],
    };
    const build = {
      ...newFormatBuild(projectId, 'opengd77-1701', 'Omit preview'),
      formatId: 'opengd77',
    };
    const library = {
      channels: [pmrChannel],
      zones: [pmrZone, glasgowZone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
    };

    const rows = previewWireRows(build, library, 'zone');
    const pmrRow = rows.find((row) => row.libraryEntityId === pmrZone.id);
    const glasgowRow = rows.find((row) => row.libraryEntityId === glasgowZone.id);

    expect(pmrRow?.omitFromExport).toBe(true);
    expect(pmrRow?.expansionNote).toContain('Not exported as its own zone');
    expect(isPreviewRowIncludedInExport(build, library, 'zone', pmrRow!)).toBe(false);
    expect(glasgowRow?.omitFromExport).toBeFalsy();
    expect(isPreviewRowIncludedInExport(build, library, 'zone', glasgowRow!)).toBe(true);
  });

  it('includes omitFromExport zone in preview when forceInclude override is set', () => {
    const projectId = 'proj-force-include-preview';
    const pmrChannel = {
      ...newChannel(projectId, 'PMR', 'GB3PMR'),
      id: 'ch-pmr',
    };
    const pmrZone = {
      ...newZone(projectId, 'PMR446'),
      id: 'zone-pmr',
      omitFromExport: true,
      members: [{ kind: 'channel' as const, channelId: pmrChannel.id }],
    };
    const build = {
      ...newFormatBuild(projectId, 'opengd77-1701', 'Force include preview'),
      formatId: 'opengd77',
      zoneOverrides: [{ libraryEntityId: pmrZone.id, forceInclude: true }],
    };
    const library = {
      channels: [pmrChannel],
      zones: [pmrZone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
    };

    const row = previewWireRows(build, library, 'zone')[0];
    expect(row?.forceInclude).toBe(true);
    expect(isPreviewRowIncludedInExport(build, library, 'zone', row!)).toBe(true);
  });

  it('excludes force-included omit zone from preview when build excluded is set', () => {
    const projectId = 'proj-force-excluded-preview';
    const pmrChannel = { ...newChannel(projectId, 'PMR'), id: 'ch-pmr' };
    const pmrZone = {
      ...newZone(projectId, 'PMR446'),
      id: 'zone-pmr',
      omitFromExport: true,
      members: [{ kind: 'channel' as const, channelId: pmrChannel.id }],
    };
    const build = {
      ...newFormatBuild(projectId, 'opengd77-1701', 'Force excluded preview'),
      formatId: 'opengd77',
      zoneOverrides: [{ libraryEntityId: pmrZone.id, forceInclude: true, excluded: true }],
    };
    const library = {
      channels: [pmrChannel],
      zones: [pmrZone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
    };

    const row = previewWireRows(build, library, 'zone')[0];
    expect(isPreviewRowIncludedInExport(build, library, 'zone', row!)).toBe(false);
  });

  it('attaches direct zone member counts for zone wire preview rows', () => {
    const projectId = 'proj-zone-badges';
    const ch = { ...newChannel(projectId, 'Direct'), id: 'ch-1' };
    const childZone = { ...newZone(projectId, 'Child'), id: 'zone-child', members: [] };
    const parentZone = {
      ...newZone(projectId, 'Parent'),
      id: 'zone-parent',
      members: [
        { kind: 'channel' as const, channelId: ch.id },
        { kind: 'zone' as const, zoneId: childZone.id },
      ],
    };
    const build = { ...newFormatBuild(projectId, 'opengd77-1701', 'Badges'), formatId: 'opengd77' };
    const library = {
      channels: [ch],
      zones: [childZone, parentZone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
    };

    const row = previewWireRows(build, library, 'zone').find(
      (r) => r.libraryEntityId === parentZone.id,
    );
    expect(row?.displayLabel).toBe('Parent');
    expect(row?.zoneDirectMembers).toEqual({
      channelCount: 1,
      zoneCount: 1,
      channelNames: [expect.stringContaining('Direct')],
      zoneNames: ['Child'],
    });
  });

  it('excludes channels in standalone omitFromExport zones from export preview', () => {
    const projectId = 'proj-omit-channel-preview';
    const pmrChannel = { ...newChannel(projectId, 'PMR'), id: 'ch-pmr' };
    const pmrZone = {
      ...newZone(projectId, 'PMR446'),
      id: 'zone-pmr',
      omitFromExport: true,
      members: [{ kind: 'channel' as const, channelId: pmrChannel.id }],
    };
    const build = {
      ...newFormatBuild(projectId, 'opengd77-1701', 'Omit channel preview'),
      formatId: 'opengd77',
    };
    const library = {
      channels: [pmrChannel],
      zones: [pmrZone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
    };

    const row = previewWireRows(build, library, 'channel')[0];
    expect(isPreviewRowIncludedInExport(build, library, 'channel', row)).toBe(false);
  });
});
