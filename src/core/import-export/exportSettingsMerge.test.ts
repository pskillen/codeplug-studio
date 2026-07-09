import { describe, expect, it } from 'vitest';
import { getFormatExportDefaults } from './registry.ts';
import { mergeExportOptions } from '@core/services/exportBuild.ts';
import { newFormatBuild } from '@core/domain/factories.ts';
import type { FormatBuild } from '@core/models/formatBuild.ts';

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
