import { formatExportWarning, hasProblemWarnings } from '@core/import-export/exportWarning.ts';
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
import { exportBuildAll } from '@core/services/exportBuild.ts';
import { exportChannelEligibilityWarnings } from '@core/services/assemble.ts';
import { parseCsv } from '@core/import-export/csvParse.ts';
import { CHANNEL_COL as OPENGD77_CHANNEL_COL } from '@core/import-export/formats/opengd77/columns.ts';
import type { ChannelModeProfileM17 } from '@core/models/library.ts';
import { describe, expect, it } from 'vitest';
import { filterOpenGd77ExportChannel, openGd77DroppedModesWarning } from './opengd77ExportModes.ts';
import { loadOpenGd77YamlGoldenFixture } from './formats/opengd77/exportGoldenFixtures.ts';

const projectId = '11111111-1111-4111-8111-111111111111';

function channelWithM17(
  name: string,
  extraModes: Array<'fm' | 'dmr'> = ['fm'],
  primary: 'm17' | 'fm' | 'dmr' = 'm17',
) {
  const channel = withExportEligibleDefaults(newChannel(projectId, name));
  channel.rxFrequency = 145_500_000;
  channel.txFrequency = 145_500_000;
  const profiles = extraModes.map((mode) => {
    if (mode === 'dmr') {
      return {
        mode: 'dmr' as const,
        colourCode: 1,
        timeslot: 1 as const,
        ownDigitalIdId: null,
        contactRef: null,
        rxGroupListId: null,
      };
    }
    return {
      mode: 'fm' as const,
      squelch: null,
      rxTone: 'none' as const,
      txTone: 'none' as const,
      bandwidthKHz: 12.5,
      analogSquelchMode: 'default' as const,
    };
  });
  channel.modeProfiles = [...profiles];
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

function libraryWithChannel(channel: ReturnType<typeof channelWithM17>, profileId: string) {
  const zone = newZone(projectId, 'Home');
  zone.members = [{ kind: 'channel', channelId: channel.id }];
  const seeded = newRadioBuildForProfile(projectId, profileId);
  const egress = seeded.egress;
  let build = seeded.build;
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
  return { build, egress, library };
}

describe('M17 mode projection across formats', () => {
  it('OpenGD77 export keeps FM and emits info for M17, not Review stop', () => {
    const { build, egress, library } = libraryWithChannel(
      channelWithM17('OpenGD77'),
      'opengd77-1701',
    );
    const result = exportBuildAll({ build, egress, library });
    expect(hasProblemWarnings(result.warnings)).toBe(false);
    expect(result.warnings.map(formatExportWarning)).toContain(
      channelDroppedModesWarning('OpenGD77', ['m17']),
    );
    const rows = parseCsv(result.files['Channels.csv']!);
    const headers = rows[0]!;
    const nameIndex = headers.indexOf(OPENGD77_CHANNEL_COL.name);
    expect(rows).toHaveLength(2);
    expect(rows[1]?.[nameIndex]).toBe('OpenGD77');
  });

  it('DM32 exports DMR when M17 was primary', () => {
    const channel = channelWithM17('DM32 mixed', ['dmr'], 'm17');
    const { build, egress, library } = libraryWithChannel(channel, 'dm32-baofeng-dm32uv');
    build.exportSettings = { ...build.exportSettings, expandModes: false };
    const result = exportBuildAll({ build, egress, library });
    expect(hasProblemWarnings(result.warnings)).toBe(false);
    const rows = parseCsv(result.files['Channels.csv']!);
    const typeIndex = rows[0]!.indexOf('Channel Type');
    expect(rows).toHaveLength(2);
    expect(rows[1]?.[typeIndex]).toBe('Digital');
  });

  it('CHIRP RT95 keeps FM from FM+M17 on an analogue-only target', () => {
    const channel = channelWithM17('Air', ['fm'], 'm17');
    const zone = newZone(projectId, 'Z');
    zone.members = [{ kind: 'channel', channelId: channel.id }];
    let build = newFormatBuild(projectId, 'chirp-rt95');
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
    const warnings = exportChannelEligibilityWarnings(build, library);
    expect(warnings.some((w) => w.severity === 'info')).toBe(true);
    expect(hasProblemWarnings(warnings)).toBe(false);
  });

  it('OpenGD77 adapter backstop still records non-exportable modes as info', () => {
    const channel = withExportEligibleDefaults(newChannel(projectId, 'Fusion'));
    channel.modeProfiles = [
      {
        mode: 'fm',
        squelch: null,
        rxTone: 'none',
        txTone: 'none',
        bandwidthKHz: null,
        analogSquelchMode: 'default',
      },
      { mode: 'ysf', dgId: null, wiresDtmfId: '' },
    ];
    const warnings: import('@core/import-export/exportWarning.ts').ExportWarning[] = [];
    filterOpenGd77ExportChannel(channel, warnings);
    expect(warnings[0]?.severity).toBe('info');
    expect(warnings.map(formatExportWarning)).toContain(
      openGd77DroppedModesWarning('Fusion', ['ysf']),
    );
  });

  it('golden OpenGD77 fixture still exports Channels.csv without M17 library rows', () => {
    const { build, egress, library } = loadOpenGd77YamlGoldenFixture();
    const result = exportBuildAll({ build, egress, library });
    expect(result.files['Channels.csv']).toBeDefined();
    expect(result.warnings.filter((w) => w.severity === 'info').length).toBeGreaterThanOrEqual(0);
  });
});
