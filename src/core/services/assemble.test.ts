import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
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
      '33333333-3333-4333-8333-333333333333',
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
});
