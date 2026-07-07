import type { BuildExportSettings } from '@core/models/formatBuild.ts';
import {
  STORAGE_KEY_EXPORT_MAX_NAME_LENGTH,
  STORAGE_KEY_EXPORT_NAME_MODE_OVERRIDE,
  STORAGE_KEY_EXPORT_SHORTEN_NAMES,
  STORAGE_KEY_EXPORT_USE_CHANNEL_ABBREVIATION,
  STORAGE_KEY_EXPORT_USE_TG_ABBREVIATION,
  STORAGE_KEY_EXPORT_ZONE_DERIVED_SCAN,
} from '../hooks/useExportSettings.ts';
import { DEFAULT_BUILD_EXPORT_SETTINGS } from '@core/import-export/exportSettingsMerge.ts';
import type { ChannelExportNameMode } from '@core/domain/channelNaming.ts';

function readShortenNames(): boolean {
  const saved = localStorage.getItem(STORAGE_KEY_EXPORT_SHORTEN_NAMES);
  return saved !== 'false';
}

function readMaxNameLength(): number | null {
  const saved = localStorage.getItem(STORAGE_KEY_EXPORT_MAX_NAME_LENGTH);
  if (!saved) return null;
  const parsed = Number.parseInt(saved, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function readNameModeOverride(): ChannelExportNameMode {
  const saved = localStorage.getItem(STORAGE_KEY_EXPORT_NAME_MODE_OVERRIDE);
  if (
    saved === 'callsign_name' ||
    saved === 'callsign_only' ||
    saved === 'name_only' ||
    saved === 'callsign_suffix'
  ) {
    return saved;
  }
  return DEFAULT_BUILD_EXPORT_SETTINGS.nameModeOverride;
}

function readUseTalkGroupAbbreviation(): boolean {
  return localStorage.getItem(STORAGE_KEY_EXPORT_USE_TG_ABBREVIATION) === 'true';
}

function readExportZoneDerivedScanLists(): boolean {
  return localStorage.getItem(STORAGE_KEY_EXPORT_ZONE_DERIVED_SCAN) !== 'false';
}

function readUseChannelAbbreviation(): boolean {
  const saved = localStorage.getItem(STORAGE_KEY_EXPORT_USE_CHANNEL_ABBREVIATION);
  return saved !== 'false';
}

/** One-time migration from global localStorage export prefs into a build row. */
export function legacyExportSettingsFromLocalStorage(): BuildExportSettings {
  return {
    shortenNames: readShortenNames(),
    maxNameLength: readMaxNameLength(),
    nameModeOverride: readNameModeOverride(),
    useTalkGroupAbbreviation: readUseTalkGroupAbbreviation(),
    useChannelAbbreviation: readUseChannelAbbreviation(),
    exportZoneDerivedScanLists: readExportZoneDerivedScanLists(),
  };
}

export function clearLegacyExportSettingsLocalStorage(): void {
  localStorage.removeItem(STORAGE_KEY_EXPORT_SHORTEN_NAMES);
  localStorage.removeItem(STORAGE_KEY_EXPORT_MAX_NAME_LENGTH);
  localStorage.removeItem(STORAGE_KEY_EXPORT_NAME_MODE_OVERRIDE);
  localStorage.removeItem(STORAGE_KEY_EXPORT_USE_TG_ABBREVIATION);
  localStorage.removeItem(STORAGE_KEY_EXPORT_USE_CHANNEL_ABBREVIATION);
  localStorage.removeItem(STORAGE_KEY_EXPORT_ZONE_DERIVED_SCAN);
}

export function buildNeedsLegacyExportSettingsMigration(build: {
  exportSettings?: BuildExportSettings;
}): boolean {
  return build.exportSettings == null || Object.keys(build.exportSettings).length === 0;
}
