import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseProjectDocument } from '@core/import-export/formats/native-yaml/parse.ts';
import { previewWireRows } from './previewWireRows.ts';

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
    expect(rows[1]?.effectiveWireName).toBe('GB7GL Scot');
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
    const channels = aggregate.channels.map((channel, index) =>
      index === 1
        ? {
            ...channel,
            modeProfiles: [
              { mode: 'fm' as const, squelch: 50, rxTone: 'none' as const, txTone: 'none' as const, bandwidthKHz: 12.5 },
              {
                mode: 'dmr' as const,
                colourCode: 1,
                timeslot: 2,
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
    expect(multiModeRows[0]?.effectiveWireName).toMatch(/-F$/);
    expect(multiModeRows[1]?.effectiveWireName).toMatch(/-D$/);
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
});
