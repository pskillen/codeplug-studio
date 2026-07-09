import { DEFAULT_BUILD_EXPORT_SETTINGS } from '@core/import-export/exportSettingsMerge.ts';
import { getFormatExportDefaults } from '@core/import-export/registry.ts';
import type { BuildExportSettings, FormatBuild } from '@core/models/formatBuild.ts';

export type ResolvedBuildExportSettings = Required<
  Pick<
    BuildExportSettings,
    | 'shortenNames'
    | 'nameModeOverride'
    | 'useChannelAbbreviation'
    | 'useTalkGroupAbbreviation'
    | 'exportZoneDerivedScanLists'
  >
> &
  Pick<BuildExportSettings, 'maxNameLength' | 'defaultScanInclusion'>;

export function resolvedBuildExportSettings(build: FormatBuild): ResolvedBuildExportSettings {
  const stored = build.exportSettings ?? {};
  const formatDefaults = getFormatExportDefaults(build.formatId);
  const exportZoneDerivedDefault =
    formatDefaults.exportZoneDerivedScanLists ??
    DEFAULT_BUILD_EXPORT_SETTINGS.exportZoneDerivedScanLists;
  return {
    shortenNames: stored.shortenNames ?? DEFAULT_BUILD_EXPORT_SETTINGS.shortenNames,
    maxNameLength: stored.maxNameLength ?? null,
    nameModeOverride: stored.nameModeOverride ?? DEFAULT_BUILD_EXPORT_SETTINGS.nameModeOverride,
    useChannelAbbreviation:
      stored.useChannelAbbreviation ?? DEFAULT_BUILD_EXPORT_SETTINGS.useChannelAbbreviation,
    useTalkGroupAbbreviation:
      stored.useTalkGroupAbbreviation ?? DEFAULT_BUILD_EXPORT_SETTINGS.useTalkGroupAbbreviation,
    exportZoneDerivedScanLists: stored.exportZoneDerivedScanLists ?? exportZoneDerivedDefault,
    defaultScanInclusion: stored.defaultScanInclusion,
  };
}
