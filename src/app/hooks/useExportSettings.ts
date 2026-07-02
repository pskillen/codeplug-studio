import { useCallback, useState } from 'react';
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

export type ExportNameModeOverride = ChannelExportNameMode;

export interface ExportSettings {
  shortenNames: boolean;
  maxNameLength: number | null;
  nameModeOverride: ExportNameModeOverride;
  useTalkGroupAbbreviation: boolean;
  useChannelAbbreviation: boolean;
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

function readUseChannelAbbreviation(): boolean {
  return localStorage.getItem(STORAGE_KEY_EXPORT_USE_CHANNEL_ABBREVIATION) === 'true';
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
  };
}

export function useExportSettings() {
  const [shortenNames, setShortenNamesState] = useState(readShortenNames);
  const [maxNameLength, setMaxNameLengthState] = useState<number | null>(readMaxNameLength);
  const [nameModeOverride, setNameModeOverrideState] =
    useState<ExportNameModeOverride>(readNameModeOverride);
  const [useTalkGroupAbbreviation, setUseTalkGroupAbbreviationState] = useState(
    readUseTalkGroupAbbreviation,
  );
  const [useChannelAbbreviation, setUseChannelAbbreviationState] = useState(
    readUseChannelAbbreviation,
  );

  const setShortenNames = useCallback((value: boolean) => {
    setShortenNamesState(value);
    localStorage.setItem(STORAGE_KEY_EXPORT_SHORTEN_NAMES, String(value));
  }, []);

  const setMaxNameLength = useCallback((value: number | null) => {
    setMaxNameLengthState(value);
    if (value == null) {
      localStorage.removeItem(STORAGE_KEY_EXPORT_MAX_NAME_LENGTH);
    } else {
      localStorage.setItem(STORAGE_KEY_EXPORT_MAX_NAME_LENGTH, String(value));
    }
  }, []);

  const setNameModeOverride = useCallback((value: ExportNameModeOverride) => {
    setNameModeOverrideState(value);
    localStorage.setItem(STORAGE_KEY_EXPORT_NAME_MODE_OVERRIDE, value);
  }, []);

  const setUseTalkGroupAbbreviation = useCallback((value: boolean) => {
    setUseTalkGroupAbbreviationState(value);
    localStorage.setItem(STORAGE_KEY_EXPORT_USE_TG_ABBREVIATION, String(value));
  }, []);

  const setUseChannelAbbreviation = useCallback((value: boolean) => {
    setUseChannelAbbreviationState(value);
    localStorage.setItem(STORAGE_KEY_EXPORT_USE_CHANNEL_ABBREVIATION, String(value));
  }, []);

  const settings: ExportSettings = {
    shortenNames,
    maxNameLength,
    nameModeOverride,
    useTalkGroupAbbreviation,
    useChannelAbbreviation,
  };

  return {
    settings,
    shortenNames,
    setShortenNames,
    maxNameLength,
    setMaxNameLength,
    nameModeOverride,
    setNameModeOverride,
    useTalkGroupAbbreviation,
    setUseTalkGroupAbbreviation,
    useChannelAbbreviation,
    setUseChannelAbbreviation,
    exportOptionsFromSettings: (base: CpsExportOptions = {}) =>
      exportOptionsFromSettings(settings, base),
  };
}
