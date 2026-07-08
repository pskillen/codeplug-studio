import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { newChannel, newFormatBuild } from '@core/domain/factories.ts';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import { exportBuildAll } from '@core/services/exportBuild.ts';
import {
  compareCsvRecords,
  formatCsvRecordCompareFailure,
} from '../../../../test/csvRecordCompare.ts';
import {
  ANYTONE_GOLDEN_PROJECT_ID,
  minimalAnytoneExportBuild,
  minimalAnytoneExportLibrary,
} from './exportGoldenFixtures.ts';
import { serialiseAmAirCsv, serialiseFmBroadcastCsv } from './serialise.ts';
import { assemble } from '@core/services/assemble.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import type { FormatBuild } from '@core/models/formatBuild.ts';

const wireFixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../test-data/anytone/at-d890uv',
);

function airbandLibrary(): LibrarySlice {
  const airband = {
    ...newChannel(ANYTONE_GOLDEN_PROJECT_ID, 'Air station 1'),
    rxFrequency: 118_800_000,
    txFrequency: null,
    forbidTransmit: true,
    modeProfiles: [defaultModeProfile('am')],
  };
  return {
    channels: [airband],
    zones: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    scanLists: [],
  };
}

function airbandBuild(library: LibrarySlice): FormatBuild {
  return {
    ...newFormatBuild(ANYTONE_GOLDEN_PROJECT_ID, 'anytone-at-d890uv', 'Airband export'),
    layout: { sections: [] },
    channelOverrides: [{ libraryEntityId: library.channels[0]!.id, wireName: 'Air station 1' }],
  };
}

function fmBroadcastLibrary(scanInclusion: 'default' | 'skip' = 'default'): LibrarySlice {
  const fm = {
    ...newChannel(ANYTONE_GOLDEN_PROJECT_ID, 'FM station 1'),
    rxFrequency: 99_500_000,
    txFrequency: null,
    forbidTransmit: true,
    scanInclusion,
    modeProfiles: [defaultModeProfile('fm')],
  };
  return {
    channels: [fm],
    zones: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    scanLists: [],
  };
}

function fmBroadcastBuild(library: LibrarySlice): FormatBuild {
  return {
    ...newFormatBuild(ANYTONE_GOLDEN_PROJECT_ID, 'anytone-at-d890uv', 'FM export'),
    layout: { sections: [] },
    channelOverrides: [{ libraryEntityId: library.channels[0]!.id, wireName: 'FM station 1' }],
  };
}

describe('anytone/receive bank export', () => {
  it('omits AMAir.CSV and FM.CSV when no receive-bank channels', () => {
    const library = minimalAnytoneExportLibrary();
    const build = minimalAnytoneExportBuild(library);
    const result = exportBuildAll({ build, library });
    expect(result.files['AMAir.CSV']).toBeUndefined();
    expect(result.files['FM.CSV']).toBeUndefined();
  });

  it('includes AMAir.CSV and excludes airband from Channel.CSV', () => {
    const library = airbandLibrary();
    const build = airbandBuild(library);
    const result = exportBuildAll({ build, library });
    expect(result.files['AMAir.CSV']).toBeDefined();
    expect(result.files['Channel.CSV']).toBeDefined();
    expect(result.files['Channel.CSV']!.split('\n').filter(Boolean)).toHaveLength(1);
  });

  it('matches golden AMAir.CSV fixture', () => {
    const library = airbandLibrary();
    const build = airbandBuild(library);
    const assembled = assemble(build, library);
    const exported = serialiseAmAirCsv(assembled);
    const fixtureCsv = readFileSync(join(wireFixtureDir, 'AMAir.CSV'), 'utf8');
    const comparison = compareCsvRecords(fixtureCsv, exported, { nameColumn: 'Name' });
    expect(
      comparison.ok,
      formatCsvRecordCompareFailure(comparison) ||
        `records: ${comparison.originalCount} → ${comparison.exportedCount}`,
    ).toBe(true);
  });

  it('includes FM.CSV for broadcast FM and keeps ham FM in Channel.CSV', () => {
    const library = fmBroadcastLibrary();
    const build = fmBroadcastBuild(library);
    const result = exportBuildAll({ build, library });
    expect(result.files['FM.CSV']).toBeDefined();

    const hamFm = {
      ...newChannel(ANYTONE_GOLDEN_PROJECT_ID, '2m FM'),
      rxFrequency: 145_500_000,
      txFrequency: null,
      forbidTransmit: true,
      modeProfiles: [defaultModeProfile('fm')],
    };
    const mixedLibrary: LibrarySlice = {
      ...library,
      channels: [...library.channels, hamFm],
    };
    const mixedBuild: FormatBuild = {
      ...build,
      channelOverrides: [
        { libraryEntityId: library.channels[0]!.id, wireName: 'FM station 1' },
        { libraryEntityId: hamFm.id, wireName: '2m FM' },
      ],
    };
    const mixed = exportBuildAll({ build: mixedBuild, library: mixedLibrary });
    expect(mixed.files['FM.CSV']).toBeDefined();
    expect(mixed.files['Channel.CSV']!.includes('2m FM')).toBe(true);
  });

  it('matches golden FM.CSV fixture with Add scan', () => {
    const library = fmBroadcastLibrary('default');
    const build = fmBroadcastBuild(library);
    const assembled = assemble(build, library);
    const exported = serialiseFmBroadcastCsv(assembled, { defaultScanInclusion: 'scan' });
    const fixtureCsv = readFileSync(join(wireFixtureDir, 'FM.CSV'), 'utf8');
    const comparison = compareCsvRecords(fixtureCsv, exported, { nameColumn: 'Name' });
    expect(
      comparison.ok,
      formatCsvRecordCompareFailure(comparison) ||
        `records: ${comparison.originalCount} → ${comparison.exportedCount}`,
    ).toBe(true);
  });

  it('writes Del scan when channel scanInclusion is skip', () => {
    const library = fmBroadcastLibrary('skip');
    const build = fmBroadcastBuild(library);
    const assembled = assemble(build, library);
    const exported = serialiseFmBroadcastCsv(assembled, { defaultScanInclusion: 'scan' });
    expect(exported).toContain('"Del"');
    expect(exported).not.toMatch(/"FM station 1"[\s\S]*"Add"/);
  });
});
