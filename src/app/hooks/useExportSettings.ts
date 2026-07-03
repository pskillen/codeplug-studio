import { useCallback, useSyncExternalStore } from 'react';
import {
  DEFAULT_CHANNEL_EXPORT_NAME_MODE,
  type ChannelExportNameMode,
} from '@core/domain/channelNaming.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';

export const STORAGE_KEY_EXPORT_SHORTEN_NAMES = 'codeplug-studio.export.shortenNames';
export const STORAGE_KEY_EXPORT_MAX_NAME_LENGTH = 'codeplug-studio.export.maxNameLength';
export const STORAGE_KEY_EXPORT_NAME_MODE_OVERRIDE = 'codeplug-studio.export.nameModeOverride';
export const STORAGE_KEY_EXPORT_USE_TG_ABBREVIATION =
  'codeplug-studio.export.useTalkGroupAbbreviation';
export const STORAGE_KEY_EXPORT_USE_CHANNEL_ABBREVIATION =
  'codeplug-studio.export.useChannelAbbreviation';
export const STORAGE_KEY_EXPORT_ZONE_DERIVED_SCAN =
  'codeplug-studio.export.exportZoneDerivedScanLists';

export type ExportNameModeOverride = ChannelExportNameMode;

export interface ExportSettings {
  shortenNames: boolean;
  maxNameLength: number | null;
  nameModeOverride: ExportNameModeOverride;
  useTalkGroupAbbreviation: boolean;
  useChannelAbbreviation: boolean;
  exportZoneDerivedScanLists: boolean;
}

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

function readNameModeOverride(): ExportNameModeOverride {
  const saved = localStorage.getItem(STORAGE_KEY_EXPORT_NAME_MODE_OVERRIDE);
  if (
    saved === 'callsign_name' ||
    saved === 'callsign_only' ||
    saved === 'name_only' ||
    saved === 'callsign_suffix'
  ) {
    return saved;
  }
  return DEFAULT_CHANNEL_EXPORT_NAME_MODE;
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

function readSettings(): ExportSettings {
  return {
    shortenNames: readShortenNames(),
    maxNameLength: readMaxNameLength(),
    nameModeOverride: readNameModeOverride(),
    useTalkGroupAbbreviation: readUseTalkGroupAbbreviation(),
    useChannelAbbreviation: readUseChannelAbbreviation(),
    exportZoneDerivedScanLists: readExportZoneDerivedScanLists(),
  };
}

const listeners = new Set<() => void>();
let settingsSnapshot: ExportSettings | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ExportSettings {
  settingsSnapshot ??= readSettings();
  return settingsSnapshot;
}

function publish(next: ExportSettings): void {
  settingsSnapshot = next;
  for (const listener of listeners) {
    listener();
  }
}

export function exportOptionsFromSettings(
  settings: ExportSettings,
  base: CpsExportOptions = {},
): CpsExportOptions {
  return {
    ...base,
    shortenNames: settings.shortenNames,
    ...(settings.maxNameLength != null ? { maxNameLength: settings.maxNameLength } : {}),
    nameModeOverride: settings.nameModeOverride,
    useTalkGroupAbbreviation: settings.useTalkGroupAbbreviation,
    useChannelAbbreviation: settings.useChannelAbbreviation,
    exportZoneDerivedScanLists: settings.exportZoneDerivedScanLists,
  };
}

export function useExportSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setShortenNames = useCallback((value: boolean) => {
    localStorage.setItem(STORAGE_KEY_EXPORT_SHORTEN_NAMES, String(value));
    publish({ ...getSnapshot(), shortenNames: value });
  }, []);

  const setMaxNameLength = useCallback((value: number | null) => {
    if (value == null) {
      localStorage.removeItem(STORAGE_KEY_EXPORT_MAX_NAME_LENGTH);
    } else {
      localStorage.setItem(STORAGE_KEY_EXPORT_MAX_NAME_LENGTH, String(value));
    }
    publish({ ...getSnapshot(), maxNameLength: value });
  }, []);

  const setNameModeOverride = useCallback((value: ExportNameModeOverride) => {
    localStorage.setItem(STORAGE_KEY_EXPORT_NAME_MODE_OVERRIDE, value);
    publish({ ...getSnapshot(), nameModeOverride: value });
  }, []);

  const setUseTalkGroupAbbreviation = useCallback((value: boolean) => {
    localStorage.setItem(STORAGE_KEY_EXPORT_USE_TG_ABBREVIATION, String(value));
    publish({ ...getSnapshot(), useTalkGroupAbbreviation: value });
  }, []);

  const setUseChannelAbbreviation = useCallback((value: boolean) => {
    localStorage.setItem(STORAGE_KEY_EXPORT_USE_CHANNEL_ABBREVIATION, String(value));
    publish({ ...getSnapshot(), useChannelAbbreviation: value });
  }, []);

  const setExportZoneDerivedScanLists = useCallback((value: boolean) => {
    localStorage.setItem(STORAGE_KEY_EXPORT_ZONE_DERIVED_SCAN, String(value));
    publish({ ...getSnapshot(), exportZoneDerivedScanLists: value });
  }, []);

  return {
    settings,
    shortenNames: settings.shortenNames,
    setShortenNames,
    maxNameLength: settings.maxNameLength,
    setMaxNameLength,
    nameModeOverride: settings.nameModeOverride,
    setNameModeOverride,
    useTalkGroupAbbreviation: settings.useTalkGroupAbbreviation,
    setUseTalkGroupAbbreviation,
    useChannelAbbreviation: settings.useChannelAbbreviation,
    setUseChannelAbbreviation,
    exportZoneDerivedScanLists: settings.exportZoneDerivedScanLists,
    setExportZoneDerivedScanLists,
    exportOptionsFromSettings: (base: CpsExportOptions = {}) =>
      exportOptionsFromSettings(settings, base),
  };
}

/** @internal Test helper — reset store between tests. */
export function resetExportSettingsForTests(): void {
  settingsSnapshot = null;
}
