import { describe, expect, it } from 'vitest';
import { newFormatBuild } from '@core/domain/factories.ts';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { getFormatExportDefaults } from './registry.ts';
import { mergeExportOptions } from '@core/import-export/exportSettingsMerge.ts';
import { DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS } from '@core/models/channelBehaviourDefaults.ts';
import { effectiveForbidTransmit } from './channelBehaviourDefaults/resolve.ts';

describe('mergeExportOptions', () => {
  const build: FormatBuild = {
    ...newFormatBuild('proj', 'opengd77-1701'),
    exportSettings: {
      shortenNames: false,
      defaultScanInclusion: 'skip',
    },
  };

  it('merges format defaults with build export settings', () => {
    const options = mergeExportOptions(build);
    expect(options.shortenNames).toBe(false);
    expect(options.defaultScanInclusion).toBe('skip');
    expect(options.expandModes).toBe(true);
  });

  it('keeps library channel defaults when runtime options carry a stale context', () => {
    const library: Pick<LibrarySlice, 'channelDefaults'> = {
      channelDefaults: { ...DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS, forbidTransmit: true },
    };
    const stale = mergeExportOptions(build);
    const merged = mergeExportOptions(build, stale, library);
    expect(
      effectiveForbidTransmit({ forbidTransmit: 'default' }, merged.channelBehaviourContext),
    ).toBe(true);
  });

  it('getFormatExportDefaults returns chirp skip default', () => {
    expect(getFormatExportDefaults('chirp').defaultScanInclusion).toBe('skip');
  });

  it('defaults exportZoneDerivedScanLists on for dm32 and off for anytone', () => {
    const dm32 = { ...newFormatBuild('proj', 'dm32-baofeng-dm32uv'), exportSettings: {} };
    const anytone = { ...newFormatBuild('proj', 'anytone-at-d890uv'), exportSettings: {} };
    expect(mergeExportOptions(dm32).exportZoneDerivedScanLists).toBe(true);
    expect(mergeExportOptions(anytone).exportZoneDerivedScanLists).toBe(false);
  });
});
