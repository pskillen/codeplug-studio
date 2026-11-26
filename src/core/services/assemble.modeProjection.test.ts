import { formatExportWarning } from '@core/import-export/exportWarning.ts';
import type { ChannelModeProfileM17 } from '@core/models/library.ts';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import { withExportEligibleDefaults } from '@core/domain/channelTestHelpers.ts';
import {
  newChannel,
  newFormatBuild,
  newRadioBuildForProfile,
  newZone,
} from '@core/domain/factories.ts';
import {
  replaceZoneGroupingSection,
  seedZoneGroupingFromLibrary,
} from '@core/domain/zoneGroupingLayout.ts';
import { channelDroppedModesWarning } from '@core/domain/channelEligibility.ts';
import { describe, expect, it } from 'vitest';
import { assemble, exportChannelEligibilityWarnings } from './assemble.ts';
import { loadOpenGd77YamlGoldenFixture } from '@core/import-export/formats/opengd77/exportGoldenFixtures.ts';

const projectId = '11111111-1111-4111-8111-111111111111';

function fmM17Channel(name: string, primary: 'fm' | 'm17' = 'm17') {
  const channel = withExportEligibleDefaults(newChannel(projectId, name));
  channel.modeProfiles = [
    {
      mode: 'fm',
      squelch: null,
      rxTone: 'none',
      txTone: 'none',
      bandwidthKHz: 12.5,
      analogSquelchMode: 'default',
    },
  ];
  const m17Profile: ChannelModeProfileM17 = {
    mode: 'm17',
    can: 3,
    playEveryCan: null,
    destination: 'ECHO',
  };
  channel.modeProfiles.push(m17Profile);
  channel.primaryMode = primary;
  return channel;
}

describe('assemble mode projection', () => {
  it('skips M17-only channels and keeps FM from a mixed row', () => {
    const m17Only = withExportEligibleDefaults(newChannel(projectId, 'M17 only'));
    m17Only.modeProfiles = [defaultModeProfile('m17')];
    const mixed = fmM17Channel('Repeater', 'm17');
    const zone = newZone(projectId, 'Home');
    zone.members = [{ kind: 'channel', channelId: mixed.id }];
    let build = newFormatBuild(projectId, 'opengd77-1701');
    const library = {
      channels: [m17Only, mixed],
      zones: [zone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
    build = replaceZoneGroupingSection(build, seedZoneGroupingFromLibrary(library));
    const projection = assemble(build, library, {
      formatId: 'opengd77',
      profileId: 'opengd77-1701',
    });
    expect(projection.channels.map((row) => row.entity.name)).toEqual(['Repeater']);
    expect(projection.channels[0]?.entity.modeProfiles.map((p) => p.mode)).toEqual(['fm']);
    expect(projection.channels[0]?.entity.primaryMode).toBe('fm');

    const warnings = exportChannelEligibilityWarnings(build, library);
    expect(warnings.some((w) => formatExportWarning(w).includes('M17 only'))).toBe(true);
    expect(warnings.some((w) => formatExportWarning(w).includes('unsupported mode'))).toBe(true);
    expect(
      warnings.some(
        (w) => formatExportWarning(w) === channelDroppedModesWarning('Repeater', ['m17']),
      ),
    ).toBe(true);
  });

  it('does not change golden fixture channels without unsupported modes', () => {
    const { build, library } = loadOpenGd77YamlGoldenFixture();
    const before = assemble(build, library, { formatId: 'opengd77', profileId: 'opengd77-1701' });
    const after = assemble(build, library, { formatId: 'opengd77', profileId: 'opengd77-1701' });
    expect(before.channels.map((row) => row.entity.modeProfiles)).toEqual(
      after.channels.map((row) => row.entity.modeProfiles),
    );
  });

  it('projects DMR when M17 was primary on DM32', () => {
    const channel = withExportEligibleDefaults(newChannel(projectId, 'DMR primary'));
    channel.rxFrequency = 430_125_000;
    channel.txFrequency = 430_125_000;
    channel.modeProfiles = [
      {
        mode: 'dmr',
        colourCode: 1,
        timeslot: 1,
        ownDigitalIdId: null,
        contactRef: null,
        rxGroupListId: null,
      },
      defaultModeProfile('m17'),
    ];
    channel.primaryMode = 'm17';
    const zone = newZone(projectId, 'Z');
    zone.members = [{ kind: 'channel', channelId: channel.id }];
    let { build } = newRadioBuildForProfile(projectId, 'dm32-baofeng-dm32uv');
    const library = {
      channels: [channel],
      zones: [zone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
    build = replaceZoneGroupingSection(build, seedZoneGroupingFromLibrary(library));
    const projection = assemble(build, library, {
      formatId: 'dm32',
      profileId: 'dm32-baofeng-dm32uv',
    });
    expect(projection.channels[0]?.entity.primaryMode).toBe('dmr');
    expect(projection.channels[0]?.entity.modeProfiles.map((p) => p.mode)).toEqual(['dmr']);
  });
});
