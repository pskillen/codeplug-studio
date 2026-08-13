/**
 * Versioned radio-backup zip pack/parse. Not a CPS format; not Radio Info debug zips.
 * Callers pass app build strings — this module does not import Vite defines.
 */
export {
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
  RadioBackupError,
  isRadioBackupRegionPath,
  validateRadioBackupManifest,
  type RadioBackupCapturedVia,
  type RadioBackupCoverage,
  type RadioBackupManifestV1,
  type RadioBackupRegionRole,
  type RadioBackupRegionV1,
} from './types.ts';
export { packRadioBackupZip } from './pack.ts';
export { parseRadioBackupZip, type ParsedRadioBackupZip } from './parse.ts';
export {
  memoryMapFromBackupRegions,
  regionsFromDownload,
  type BackupRegionExtract,
  type BackupSparseBlock,
  type RegionsFromDownloadInput,
} from './regionsFromDownload.ts';
