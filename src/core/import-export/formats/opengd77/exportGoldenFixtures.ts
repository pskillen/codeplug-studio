import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  newChannel,
  newFormatBuild,
  newRadioBuildForProfile,
  newTalkGroup,
} from '@core/domain/factories.ts';
import type { Channel } from '@core/models/library.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import { parseProjectDocument } from '@core/import-export/formats/native-yaml/parse.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { assemble } from '@core/services/assemble.ts';

const yamlFixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../native-yaml/__fixtures__/export',
);

export const OPENGD77_GOLDEN_PROJECT_ID = '11111111-1111-4111-8111-111111111111';

export function opengd77GoldenEgress(): EgressPath {
  return newRadioBuildForProfile(OPENGD77_GOLDEN_PROJECT_ID, 'opengd77-1701').egress;
}

/** Library + build from the shared native-yaml export fixture (with-radio-build.yaml). */
export function loadOpenGd77YamlGoldenFixture(): {
  build: RadioBuild;
  egress: EgressPath;
  library: LibrarySlice;
} {
  const yaml = readFileSync(join(yamlFixtureDir, 'with-radio-build.yaml'), 'utf8');
  const aggregate = parseProjectDocument(yaml);
  const build = aggregate.radioBuilds[0]!;
  const egress = aggregate.egressPaths[0]!;
  const library: LibrarySlice = {
    channels: aggregate.channels,
    zones: aggregate.zones,
    talkGroups: aggregate.talkGroups,
    digitalContacts: aggregate.digitalContacts,
    analogContacts: aggregate.analogContacts,
    rxGroupLists: aggregate.rxGroupLists,
    scanLists: [],
  };
  return { build, egress, library };
}

export function assembleOpenGd77YamlGolden(
  library: LibrarySlice,
  build: RadioBuild,
  options?: { shortenNames?: boolean },
) {
  return assemble(build, library, {
    formatId: 'opengd77',
    profileId: 'opengd77-1701',
    shortenNames: options?.shortenNames,
  });
}

/** One logical channel with FM + DMR mode profiles for multi-mode golden assertions. */
export function multiModeOpenGd77ExportLibrary(base: LibrarySlice): LibrarySlice {
  const tg = base.talkGroups[0]!;
  const rgl = base.rxGroupLists[0]!;
  const source = base.channels[1]!;
  const multiCh: Channel = {
    ...source,
    id: '77777777-7777-4777-8777-777777777777',
    name: 'GB7GL Multi',
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
        colourCode: 7,
        timeslot: 2 as const,
        dmrId: 234_999,
        contactRef: { kind: 'talkGroup' as const, id: tg.id },
        rxGroupListId: rgl.id,
      },
    ],
  };
  return {
    ...base,
    channels: [base.channels[0]!, multiCh],
  };
}

export function multiModeOpenGd77ExportBuild(library: LibrarySlice): RadioBuild {
  const { build } = loadOpenGd77YamlGoldenFixture();
  const multiCh = library.channels[1]!;
  return {
    ...build,
    layout: {
      sections: build.layout.sections.filter((s) => s.kind === 'zoneGrouping'),
    },
    channelOverrides: [
      ...(build.channelOverrides ?? []).filter((o) => o.libraryEntityId !== multiCh.id),
      { libraryEntityId: multiCh.id, wireName: 'GB7GL Multi' },
    ],
  };
}

/** Long talk-group name for shortening-at-16-char export case. */
export function shorteningOpenGd77ExportLibrary(base: LibrarySlice): LibrarySlice {
  const tg = base.talkGroups[0]!;
  const ch = base.channels[1]!;
  const dmrProfile = ch.modeProfiles.find((p) => p.mode === 'dmr');
  const updatedCh: Channel = dmrProfile
    ? {
        ...ch,
        modeProfiles: ch.modeProfiles.map((p) =>
          p.mode === 'dmr'
            ? {
                ...p,
                contactRef: { kind: 'talkGroup' as const, id: tg.id },
              }
            : p,
        ),
      }
    : ch;
  return {
    ...base,
    channels: [base.channels[0]!, updatedCh],
    talkGroups: [
      {
        ...tg,
        name: 'Scotland West Region',
        abbreviation: 'Scot West',
      },
    ],
  };
}

export function shorteningOpenGd77ExportBuild(library: LibrarySlice): RadioBuild {
  const tg = library.talkGroups[0]!;
  const ch = library.channels[1]!;
  const zone = library.zones[0]!;
  return {
    ...newFormatBuild(OPENGD77_GOLDEN_PROJECT_ID, 'opengd77-1701', 'Shorten export'),
    layout: {
      sections: [
        {
          kind: 'zoneGrouping',
          zones: [{ id: zone.id, name: zone.name, channelIds: [ch.id] }],
        },
      ],
    },
    channelOverrides: [{ libraryEntityId: ch.id, wireName: 'GB7GL Scot' }],
    talkGroupOverrides: [{ libraryEntityId: tg.id, wireName: tg.name }],
  };
}
