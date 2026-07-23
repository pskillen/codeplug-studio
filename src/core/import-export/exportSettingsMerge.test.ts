import { describe, expect, it } from 'vitest';
import { newFormatBuild } from '@core/domain/factories.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { getFormatExportDefaults } from './registry.ts';
import { mergeExportOptions } from '@core/import-export/exportSettingsMerge.ts';
import { DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS } from '@core/models/channelBehaviourDefaults.ts';
import { effectiveForbidTransmit } from './channelBehaviourDefaults/resolve.ts';

describe('mergeExportOptions', () => {
  const build: RadioBuild = {
    ...newFormatBuild('proj', 'opengd77-1701'),
    exportSettings: {
      shortenNames: false,
      defaultScanInclusion: 'skip',
    },
  };

  it('merges format defaults with build export settings', () => {
    const options = mergeExportOptions(build, 'opengd77');
    expect(options.shortenNames).toBe(false);
    expect(options.defaultScanInclusion).toBe('skip');
    expect(options.expandModes).toBe(true);
  });

  it('keeps library channel defaults when runtime options carry a stale context', () => {
    const library: Pick<LibrarySlice, 'channelDefaults'> = {
      channelDefaults: { ...DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS, forbidTransmit: true },
    };
    const stale = mergeExportOptions(build, 'opengd77');
    const merged = mergeExportOptions(build, 'opengd77', stale, library);
    expect(
      effectiveForbidTransmit({ forbidTransmit: 'default' }, merged.channelBehaviourContext),
    ).toBe(true);
  });

  it('getFormatExportDefaults returns chirp skip default', () => {
    expect(getFormatExportDefaults('chirp').defaultScanInclusion).toBe('skip');
  });

  it('getFormatExportDefaults enables m×n for radio-io-dm32uv profile', () => {
    expect(getFormatExportDefaults('radio-io').expandRxGroupLists).toBe(false);
    expect(getFormatExportDefaults('radio-io', 'radio-io-dm32uv').expandRxGroupLists).toBe(true);
    expect(getFormatExportDefaults('radio-io', 'radio-io-dm32uv').exportScratchChannels).toBe(true);
  });

  it('mergeExportOptions applies radio-io-dm32uv m×n defaults via profileId', () => {
    const build = { ...newFormatBuild('proj', 'radio-io-dm32uv'), exportSettings: {} };
    const options = mergeExportOptions(build, 'radio-io', { profileId: 'radio-io-dm32uv' });
    expect(options.expandRxGroupLists).toBe(true);
    expect(options.exportScratchChannels).toBe(true);
  });

  it('defaults exportZoneDerivedScanLists on for dm32 and off for anytone', () => {
    const dm32 = { ...newFormatBuild('proj', 'dm32-baofeng-dm32uv'), exportSettings: {} };
    const anytone = { ...newFormatBuild('proj', 'anytone-at-d890uv'), exportSettings: {} };
    expect(mergeExportOptions(dm32, 'dm32').exportZoneDerivedScanLists).toBe(true);
    expect(mergeExportOptions(anytone, 'anytone').exportZoneDerivedScanLists).toBe(false);
  });

  it('carries egress profileId for wire-name limit resolution', () => {
    const chirp = newFormatBuild('proj', 'chirp-uv5r');
    const options = mergeExportOptions(chirp, 'chirp', { profileId: 'chirp-uv5r' });
    expect(options.profileId).toBe('chirp-uv5r');
    expect(options.shortenNames).toBe(true);
  });
});
