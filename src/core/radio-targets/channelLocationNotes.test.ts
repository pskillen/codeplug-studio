import { describe, expect, it } from 'vitest';
import { newChannel, newRadioBuildForProfile } from '@core/domain/factories.ts';
import { withExportEligibleDefaults } from '@core/domain/channelTestHelpers.ts';
import { formatExportWarning } from '@core/import-export/exportWarning.ts';
import { exportBuildAll } from '@core/services/exportBuild.ts';
import {
  channelLocationWriteSummary,
  hasMm9pdyChannelLocationSibling,
  isMm9pdyChannelLocationTarget,
} from './channelLocationNotes.ts';

describe('channel location targets', () => {
  it('knows the MM9PDY targets and their stock siblings', () => {
    expect(isMm9pdyChannelLocationTarget('anytone-at-d890uv-mm9pdy')).toBe(true);
    expect(isMm9pdyChannelLocationTarget('baofeng-dm32uv-mm9pdy')).toBe(true);
    expect(isMm9pdyChannelLocationTarget('anytone-at-d890uv')).toBe(false);
    expect(hasMm9pdyChannelLocationSibling('anytone-at-d890uv')).toBe(true);
    expect(hasMm9pdyChannelLocationSibling('baofeng-dm32uv')).toBe(true);
    expect(hasMm9pdyChannelLocationSibling('baofeng-dm1701')).toBe(false);
  });
});

describe('channelLocationWriteSummary', () => {
  it('lists written and skipped counts with reasons', () => {
    expect(
      channelLocationWriteSummary({
        written: 5,
        noPosition: 2,
        useLocationOff: 1,
        overCapacity: 3,
      }),
    ).toBe(
      "Channel positions: 5 written; 1 with Use location off, 3 over the radio's table capacity not written. 2 channels have no position.",
    );
    expect(
      channelLocationWriteSummary({
        written: 1,
        noPosition: 0,
        useLocationOff: 0,
        overCapacity: 0,
      }),
    ).toBe('Channel positions: 1 written.');
    expect(
      channelLocationWriteSummary({
        written: 0,
        noPosition: 4,
        useLocationOff: 0,
        overCapacity: 0,
      }),
    ).toBeNull();
  });
});

describe('stock file export note', () => {
  function located(projectId: string) {
    return withExportEligibleDefaults({
      ...newChannel(projectId, 'GB3GL'),
      id: 'ch-1',
      rxFrequency: 145_725_000,
      txFrequency: 145_125_000,
      location: { lat: 55.85, lon: -4.26 },
      useLocation: true,
    });
  }
  const library = (channel: ReturnType<typeof located>) => ({
    channels: [channel],
    zones: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    scanLists: [],
  });

  it.each(['anytone-at-d890uv', 'dm32-baofeng-dm32uv'])(
    'notes MM9PDY on %s file export',
    (profileId) => {
      const { build, egress } = newRadioBuildForProfile('p1', profileId);
      const result = exportBuildAll({ build, egress, library: library(located('p1')) });
      const notes = result.warnings
        .filter((w) => w.kind === 'general' && w.severity === 'info')
        .map(formatExportWarning);
      expect(notes).toEqual([
        '1 channel in this build has a position. Positions are not written by this target: the MM9PDY modded firmware target writes them.',
      ]);
    },
  );

  it('adds nothing for a target without an MM9PDY sibling', () => {
    const { build, egress } = newRadioBuildForProfile('p1', 'opengd77-1701');
    const result = exportBuildAll({ build, egress, library: library(located('p1')) });
    expect(result.warnings.filter((w) => w.kind === 'general' && w.severity === 'info')).toEqual(
      [],
    );
  });
});
