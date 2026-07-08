import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import {
  newChannel,
  newFormatBuild,
  newRxGroupList,
  newTalkGroup,
  newZone,
} from '@core/domain/factories.ts';
import { seedZoneGroupingFromLibrary } from '@core/domain/zoneGroupingLayout.ts';
import { assemble, type LibrarySlice } from '@core/services/assemble.ts';
import { serialiseDm32Files } from './serialise.ts';
import { CHANNEL_COL, ZONE_COL, SCAN_COL, RX_GROUP_LIST_COL } from './columns.ts';
import { parseCsv } from '@core/import-export/csvParse.ts';
import { minimalDm32Bundle } from '../../../../test/dm32/bundles.ts';
import {
  minimalDm32ExportBuild,
  minimalDm32ExportLibrary,
} from '../../../../test/dm32/minimalExportLibrary.ts';
import {
  compareCsvHeaders,
  compareDm32ExportBundle,
  DM32_CORE_EXPORT_FILES,
  formatDm32BundleCompareFailure,
} from '../../../../test/dm32CsvCompare.ts';
import { exportBuildAll } from '@core/services/exportBuild.ts';
import {
  FIXTURE_CHANNEL_A_ID,
  FIXTURE_CHANNEL_B_ID,
  FIXTURE_CHILD_ZONE_ID,
  FIXTURE_PARENT_ZONE_ID,
  FIXTURE_PROJECT_ID,
  glasgowPmrNestedAggregate,
} from '@core/import-export/formats/native-yaml/testFixtures.ts';

const fixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../test-data/baofeng-dm32/v1.60',
);

const PROJECT_ID = 'proj-1';

function fmChannel(name: string, overrides: Partial<Channel> = {}): Channel {
  return {
    ...newChannel(PROJECT_ID, name),
    rxFrequency: 430_012_500,
    txFrequency: 430_012_500,
    modeProfiles: [{ mode: 'fm', squelch: 50, rxTone: 'none', txTone: 'none', bandwidthKHz: 12.5 }],
    ...overrides,
  };
}

function dm32Build(): FormatBuild {
  return newFormatBuild(PROJECT_ID, 'dm32-baofeng-dm32uv', 'DM32 test');
}

describe('DM32 export serialise', () => {
  it('serialises a minimal channel to Channels.csv', () => {
    const channel = fmChannel('GB3DA');
    const build = dm32Build();
    const library: LibrarySlice = {
      channels: [channel],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
    const assembled = assemble(build, library);
    const files = serialiseDm32Files(assembled, library);
    const rows = parseCsv(files['Channels.csv']);
    const headers = rows[0]!;
    const nameIndex = headers.indexOf(CHANNEL_COL.name);
    expect(rows[1]?.[nameIndex]).toBe('GB3DA');
  });

  it('serialises zones with pipe-separated member names', () => {
    const channel = fmChannel('Test Chan');
    const zone = newZone(PROJECT_ID, 'My Zone');
    zone.members = [{ kind: 'channel' as const, channelId: channel.id }];
    const build = dm32Build();
    const library: LibrarySlice = {
      channels: [channel],
      zones: [zone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
    const assembled = assemble(build, library);
    const files = serialiseDm32Files(assembled, library);
    const rows = parseCsv(files['Zones.csv']);
    const headers = rows[0]!;
    const membersIndex = headers.indexOf(ZONE_COL.members);
    expect(rows[1]?.[membersIndex]).toBe('Test Chan');
  });

  it('flattens nested zones and omits nested-only zone in Zones.csv', () => {
    const aggregate = glasgowPmrNestedAggregate();
    const library: LibrarySlice = {
      channels: aggregate.channels,
      zones: aggregate.zones,
      talkGroups: aggregate.talkGroups,
      digitalContacts: aggregate.digitalContacts,
      analogContacts: aggregate.analogContacts,
      rxGroupLists: aggregate.rxGroupLists,
      scanLists: [],
    };
    const build: FormatBuild = {
      ...newFormatBuild(FIXTURE_PROJECT_ID, 'dm32-baofeng-dm32uv', 'Nested export'),
      formatId: 'dm32',
      layout: {
        sections: [
          {
            kind: 'zoneGrouping',
            zones: [
              {
                id: FIXTURE_PARENT_ZONE_ID,
                name: 'Glasgow',
                channelIds: [FIXTURE_CHANNEL_B_ID],
              },
              {
                id: FIXTURE_CHILD_ZONE_ID,
                name: 'PMR446',
                channelIds: [FIXTURE_CHANNEL_A_ID],
              },
            ],
          },
        ],
      },
    };
    const files = serialiseDm32Files(assemble(build, library), library);
    const zoneRows = parseCsv(files['Zones.csv']);
    const headers = zoneRows[0]!;
    const nameIndex = headers.indexOf(ZONE_COL.name);
    const membersIndex = headers.indexOf(ZONE_COL.members);
    const dataRows = zoneRows.slice(1);
    expect(dataRows.map((row) => row[nameIndex])).toEqual(['Glasgow']);
    expect(dataRows[0]?.[membersIndex]).toBe('GB7GL DMR Scot|GB3DA GB3DA Demo');
  });

  it('expands RX group list members into separate channel rows', () => {
    const tg1 = newTalkGroup(PROJECT_ID, 'Worldwide', 1);
    const tg2 = newTalkGroup(PROJECT_ID, 'Local', 2);
    const channel: Channel = {
      ...newChannel(PROJECT_ID, 'GB7RR'),
      rxFrequency: 430_000_000,
      txFrequency: 430_000_000,
      modeProfiles: [
        {
          mode: 'dmr',
          colourCode: 1,
          timeslot: 1,
          dmrId: null,
          contactRef: null,
          rxGroupListId: 'rgl-1',
        },
      ],
    };
    const build = dm32Build();
    const library: LibrarySlice = {
      channels: [channel],
      talkGroups: [tg1, tg2],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [
        {
          ...newRxGroupList(PROJECT_ID, 'My RGL'),
          id: 'rgl-1',
          members: [
            { ref: { kind: 'talkGroup', id: tg1.id } },
            { ref: { kind: 'talkGroup', id: tg2.id } },
          ],
        },
      ],
      zones: [],
      scanLists: [],
    };
    const assembled = assemble(build, library);
    const files = serialiseDm32Files(assembled, library);
    const rows = parseCsv(files['Channels.csv']);
    expect(rows.length).toBe(3);
  });

  it('shortens long zone and RX group list names when shortenNames is enabled', () => {
    const longZoneName = 'GLA GLASGOW TOWER ZONE NAME';
    const longRglName = 'Scotland West Receive Group List';
    const channel = fmChannel('GB3DA');
    const zone = newZone(PROJECT_ID, longZoneName);
    zone.members = [{ kind: 'channel' as const, channelId: channel.id }];
    const rgl = newRxGroupList(PROJECT_ID, longRglName);
    const build = dm32Build();
    const library: LibrarySlice = {
      channels: [channel],
      zones: [zone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [rgl],
      scanLists: [],
    };
    const assembled = assemble(build, library);
    const files = serialiseDm32Files(assembled, library, {
      profileId: 'dm32-baofeng-dm32uv',
      shortenNames: true,
    });
    const zoneRows = parseCsv(files['Zones.csv']);
    const zoneNameIndex = zoneRows[0]!.indexOf(ZONE_COL.name);
    expect(zoneRows[1]?.[zoneNameIndex]?.length).toBeLessThanOrEqual(16);

    const rglRows = parseCsv(files['RXGroupLists.csv']);
    const rglNameIndex = rglRows[0]!.indexOf(RX_GROUP_LIST_COL.name);
    expect(rglRows[1]?.[rglNameIndex]?.length).toBeLessThanOrEqual(16);
  });

  it('emits Scan.csv and carrier when zone exportScanList is enabled', () => {
    const channel = fmChannel('Member One');
    const zone = newZone(PROJECT_ID, 'Glasgow');
    zone.members = [{ kind: 'channel' as const, channelId: channel.id }];
    const build = dm32Build();
    const layout = seedZoneGroupingFromLibrary({
      channels: [channel],
      zones: [zone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    });
    layout.zones[0] = {
      ...layout.zones[0]!,
      exportScanList: true,
      scanCarrierFrequencyHz: 145_500_000,
    };
    build.layout = { sections: [layout] };

    const library: LibrarySlice = {
      channels: [channel],
      zones: [zone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
    const assembled = {
      ...assemble(build, library),
      library,
      zoneGrouping: layout,
    };
    const files = serialiseDm32Files(assembled, library);
    const scanRows = parseCsv(files['Scan.csv']);
    expect(scanRows.length).toBeGreaterThan(1);
    const scanNameIndex = scanRows[0]!.indexOf(SCAN_COL.name);
    expect(scanRows[1]?.[scanNameIndex]).toBe('Glasgow');

    const channelRows = parseCsv(files['Channels.csv']);
    const scanListIndex = channelRows[0]!.indexOf(CHANNEL_COL.scanList);
    const hasScanFk = channelRows.slice(1).some((row) => row[scanListIndex] === 'Glasgow');
    expect(hasScanFk).toBe(true);

    const zoneRows = parseCsv(files['Zones.csv']);
    const membersIndex = zoneRows[0]!.indexOf(ZONE_COL.members);
    expect(zoneRows[1]?.[membersIndex]).toMatch(/^Glasgow Scan\|/);
  });

  /**
   * Excluded from row compare: No., Scan List (zone-derived), DMR ID (radio label).
   * See docs/reference/dm32/channels.md and export-mapping.md.
   */
  it('minimal library export matches synthetic golden bundle', () => {
    const build = minimalDm32ExportBuild();
    const library = minimalDm32ExportLibrary();
    const assembled = { ...assemble(build, library), library };
    const exported = serialiseDm32Files(assembled, library);
    const comparison = compareDm32ExportBundle(minimalDm32Bundle, exported);
    expect(comparison.ok, formatDm32BundleCompareFailure(comparison)).toBe(true);
  });

  it('exportBuildAll returns core DM32 CSV files for minimal library', () => {
    const build = minimalDm32ExportBuild();
    const library = minimalDm32ExportLibrary();
    const result = exportBuildAll({ build, library });
    const fileNames = Object.keys(result.files).sort();
    for (const fileName of DM32_CORE_EXPORT_FILES) {
      expect(fileNames).toContain(fileName);
    }
    expect(result.files['Channels.csv']).toContain('GB7FE Stirling');
  });

  it('v1.60 fixture headers match export headers for core files', () => {
    const build = minimalDm32ExportBuild();
    const library = minimalDm32ExportLibrary();
    const exported = serialiseDm32Files({ ...assemble(build, library), library }, library);
    for (const fileName of DM32_CORE_EXPORT_FILES) {
      const fixtureCsv = readFileSync(join(fixtureDir, fileName), 'utf8');
      expect(compareCsvHeaders(fixtureCsv, exported[fileName]!)).toBe(true);
    }
  });
});
