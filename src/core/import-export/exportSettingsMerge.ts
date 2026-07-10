import { DEFAULT_CHANNEL_EXPORT_NAME_MODE } from '@core/domain/channelNaming.ts';
import { DEFAULT_MULTI_TG_EXPORT_NAME_MODE } from '@core/import-export/types.ts';
import type { BuildExportSettings } from '@core/models/formatBuild.ts';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { CpsExportOptions, FormatExportDefaults } from '@core/import-export/types.ts';
import { getFormatExportDefaults } from '@core/import-export/registry.ts';

export const DEFAULT_BUILD_EXPORT_SETTINGS: Required<
  Pick<
    BuildExportSettings,
    | 'shortenNames'
    | 'nameModeOverride'
    | 'useChannelAbbreviation'
    | 'useTalkGroupAbbreviation'
    | 'exportZoneDerivedScanLists'
    | 'multiTalkGroupExportNameMode'
    | 'expandRxGroupListMembers'
  >
> = {
  shortenNames: true,
  nameModeOverride: DEFAULT_CHANNEL_EXPORT_NAME_MODE,
  useChannelAbbreviation: true,
  useTalkGroupAbbreviation: true,
  exportZoneDerivedScanLists: true,
  multiTalkGroupExportNameMode: DEFAULT_MULTI_TG_EXPORT_NAME_MODE,
  expandRxGroupListMembers: 'all',
};

function storedToCpsOptions(stored: BuildExportSettings): CpsExportOptions {
  const options: CpsExportOptions = {};
  if (stored.shortenNames !== undefined) options.shortenNames = stored.shortenNames;
  if (stored.maxNameLength !== undefined && stored.maxNameLength !== null) {
    options.maxNameLength = stored.maxNameLength;
  }
  if (stored.nameModeOverride !== undefined) options.nameModeOverride = stored.nameModeOverride;
  if (stored.useChannelAbbreviation !== undefined) {
    options.useChannelAbbreviation = stored.useChannelAbbreviation;
  }
  if (stored.useTalkGroupAbbreviation !== undefined) {
    options.useTalkGroupAbbreviation = stored.useTalkGroupAbbreviation;
  }
  if (stored.exportZoneDerivedScanLists !== undefined) {
    options.exportZoneDerivedScanLists = stored.exportZoneDerivedScanLists;
  }
  if (stored.multiTalkGroupExportNameMode !== undefined) {
    options.multiTalkGroupExportNameMode = stored.multiTalkGroupExportNameMode;
  }
  if (stored.expandModes !== undefined) options.expandModes = stored.expandModes;
  if (stored.expandRxGroupLists !== undefined) {
    options.expandRxGroupLists = stored.expandRxGroupLists;
  }
  if (stored.expandRxGroupListMembers !== undefined) {
    options.expandRxGroupListMembers = stored.expandRxGroupListMembers;
  }
  if (stored.exportScratchChannels !== undefined) {
    options.exportScratchChannels = stored.exportScratchChannels;
  }
  if (stored.defaultScanInclusion !== undefined) {
    options.defaultScanInclusion = stored.defaultScanInclusion;
  }
  return options;
}

function applyFormatExportDefaults(defaults: FormatExportDefaults): CpsExportOptions {
  return {
    defaultScanInclusion: defaults.defaultScanInclusion,
    ...(defaults.expandModes !== undefined ? { expandModes: defaults.expandModes } : {}),
    ...(defaults.expandRxGroupLists !== undefined
      ? { expandRxGroupLists: defaults.expandRxGroupLists }
      : {}),
    ...(defaults.exportZoneDerivedScanLists !== undefined
      ? { exportZoneDerivedScanLists: defaults.exportZoneDerivedScanLists }
      : {}),
    ...(defaults.exportScratchChannels !== undefined
      ? { exportScratchChannels: defaults.exportScratchChannels }
      : {}),
  };
}

/** Merge format defaults, build-stored settings, and runtime overrides for export. */
export function mergeExportOptions(
  build: FormatBuild,
  options?: CpsExportOptions,
): CpsExportOptions {
  const formatDefaults = getFormatExportDefaults(build.formatId);
  const stored = build.exportSettings ?? {};
  return {
    shortenNames: DEFAULT_BUILD_EXPORT_SETTINGS.shortenNames,
    nameModeOverride: DEFAULT_BUILD_EXPORT_SETTINGS.nameModeOverride,
    useChannelAbbreviation: DEFAULT_BUILD_EXPORT_SETTINGS.useChannelAbbreviation,
    useTalkGroupAbbreviation: DEFAULT_BUILD_EXPORT_SETTINGS.useTalkGroupAbbreviation,
    exportZoneDerivedScanLists: DEFAULT_BUILD_EXPORT_SETTINGS.exportZoneDerivedScanLists,
    multiTalkGroupExportNameMode: DEFAULT_BUILD_EXPORT_SETTINGS.multiTalkGroupExportNameMode,
    expandRxGroupListMembers: DEFAULT_BUILD_EXPORT_SETTINGS.expandRxGroupListMembers,
    ...applyFormatExportDefaults(formatDefaults),
    ...storedToCpsOptions(stored),
    ...options,
    profileId: options?.profileId ?? build.profileId,
  };
}
