import { DEFAULT_BUILD_EXPORT_SETTINGS } from '@core/import-export/exportSettingsMerge.ts';
import { DEFAULT_DIGITAL_CONTACT_EXPORT_NAME_MODE } from '@core/import-export/types.ts';
import { getFormatExportDefaults } from '@core/import-export/registry.ts';
import type { BuildExportSettings, FormatBuild } from '@core/models/formatBuild.ts';
import type { DigitalContactExportNameMode } from '@core/import-export/types.ts';

export type ResolvedBuildExportSettings = Required<
  Pick<
    BuildExportSettings,
    | 'shortenNames'
    | 'nameModeOverride'
    | 'useChannelAbbreviation'
    | 'useTalkGroupAbbreviation'
    | 'exportZoneDerivedScanLists'
    | 'expandRxGroupLists'
    | 'exportScratchChannels'
    | 'digitalContactExportNameMode'
  >
> &
  Pick<BuildExportSettings, 'maxNameLength' | 'defaultScanInclusion'>;

export function resolvedBuildExportSettings(build: FormatBuild): ResolvedBuildExportSettings {
  const stored = build.exportSettings ?? {};
  const formatDefaults = getFormatExportDefaults(build.formatId);
  const exportZoneDerivedDefault =
    formatDefaults.exportZoneDerivedScanLists ??
    DEFAULT_BUILD_EXPORT_SETTINGS.exportZoneDerivedScanLists;
  const expandRxGroupListsDefault =
    formatDefaults.expandRxGroupLists ?? stored.expandRxGroupLists ?? false;
  const exportScratchChannelsDefault =
    formatDefaults.exportScratchChannels ?? stored.exportScratchChannels ?? false;
  return {
    shortenNames: stored.shortenNames ?? DEFAULT_BUILD_EXPORT_SETTINGS.shortenNames,
    maxNameLength: stored.maxNameLength ?? null,
    nameModeOverride: stored.nameModeOverride ?? DEFAULT_BUILD_EXPORT_SETTINGS.nameModeOverride,
    useChannelAbbreviation:
      stored.useChannelAbbreviation ?? DEFAULT_BUILD_EXPORT_SETTINGS.useChannelAbbreviation,
    useTalkGroupAbbreviation:
      stored.useTalkGroupAbbreviation ?? DEFAULT_BUILD_EXPORT_SETTINGS.useTalkGroupAbbreviation,
    exportZoneDerivedScanLists: stored.exportZoneDerivedScanLists ?? exportZoneDerivedDefault,
    expandRxGroupLists: stored.expandRxGroupLists ?? expandRxGroupListsDefault,
    exportScratchChannels: stored.exportScratchChannels ?? exportScratchChannelsDefault,
    digitalContactExportNameMode:
      stored.digitalContactExportNameMode ?? DEFAULT_DIGITAL_CONTACT_EXPORT_NAME_MODE,
    defaultScanInclusion: stored.defaultScanInclusion,
  };
}

export type { DigitalContactExportNameMode };
