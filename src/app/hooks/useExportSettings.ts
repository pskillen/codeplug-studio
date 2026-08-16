/**
 * Legacy localStorage keys for build-level export/write naming preferences.
 *
 * These preferences now live on `build.exportSettings` (see
 * `../lib/buildExportSettingsUi.ts`), persisted per build instead of globally in the
 * browser. The keys and readers below exist only for the one-time migration in
 * `../lib/migrateLegacyExportSettings.ts`, which copies any values a returning operator
 * still has in localStorage onto their first build, then clears them.
 */
export const STORAGE_KEY_EXPORT_SHORTEN_NAMES = 'codeplug-studio.export.shortenNames';
export const STORAGE_KEY_EXPORT_MAX_NAME_LENGTH = 'codeplug-studio.export.maxNameLength';
export const STORAGE_KEY_EXPORT_NAME_MODE_OVERRIDE = 'codeplug-studio.export.nameModeOverride';
export const STORAGE_KEY_EXPORT_USE_TG_ABBREVIATION =
  'codeplug-studio.export.useTalkGroupAbbreviation';
export const STORAGE_KEY_EXPORT_USE_CHANNEL_ABBREVIATION =
  'codeplug-studio.export.useChannelAbbreviation';
export const STORAGE_KEY_EXPORT_ZONE_DERIVED_SCAN =
  'codeplug-studio.export.exportZoneDerivedScanLists';
