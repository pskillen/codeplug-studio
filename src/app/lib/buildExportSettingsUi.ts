import { DEFAULT_BUILD_EXPORT_SETTINGS } from '@core/import-export/exportSettingsMerge.ts';
import { DEFAULT_DIGITAL_CONTACT_EXPORT_NAME_MODE } from '@core/import-export/types.ts';
import { getFormatExportDefaults } from '@core/import-export/registry.ts';
import type { BuildExportSettings, RadioBuild } from '@core/models/formatBuild.ts';
import type { DigitalContactExportNameMode } from '@core/import-export/types.ts';
import { defaultCompatibleEgress } from '@core/radio-targets/index.ts';

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

/**
 * Merge stored radio-level `exportSettings` with format defaults from the catalog
 * **default** compatible egress — never the active pathway — so Export UI fill-ins
 * stay stable when switching CHIRP / NeonPlug / Web Serial.
 */
export function resolvedBuildExportSettings(build: RadioBuild): ResolvedBuildExportSettings {
  const stored = build.exportSettings ?? {};
  const resolvedFormatId = defaultCompatibleEgress(build.radioTargetId)?.formatId ?? 'opengd77';
  const formatDefaults = getFormatExportDefaults(resolvedFormatId);
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

/** Format defaults for Export projection UI — catalog default egress, not active pathway. */
export function radioBuildFormatExportDefaults(build: RadioBuild) {
  const formatId = defaultCompatibleEgress(build.radioTargetId)?.formatId ?? 'opengd77';
  return getFormatExportDefaults(formatId);
}

export type { DigitalContactExportNameMode };
