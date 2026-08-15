/**
 * OpenGD77 / OpenUV380 family — shared codecs + DM-1701 descriptor exports for UI.
 */

export { OPENGD77_DM1701_MODEL_ID, OPENGD77_MD9600_MODEL_ID } from './hydration.ts';
export {
  summariseOpenGd77Clone,
  type OpenGd77CloneSummary,
  type OpenGd77OnRadioCounts,
  type OpenGd77RetainGroupSummary,
} from './cloneSummary.ts';
export {
  settingsRetainPreview,
  ancillaryRetainPreview,
  type OpenGd77RetainPreviewRow,
  type OpenGd77AncillaryRetainPreview,
} from './retainPreview.ts';
export {
  OPENGD77_WRITTEN_FROM_BUILD_LABELS,
  OPENGD77_DTMF_CONTACTS_WRITE_GAP,
  OPENGD77_APRS_WRITE_GAP,
  OPENGD77_USER_DATABASE_WRITE_NOTE,
} from './writeRole.ts';
export {
  OPENGD77_BACKUP_FLASH_SPANS,
  openGd77BackupRestoreRole,
  type OpenGd77BackupFlashSpan,
} from './backupRestoreRoles.ts';
export {
  intendedOpenGd77RestoreImage,
  listOpenGd77RestoreDirtySectors,
} from './restoreFromBackup.ts';
export { OPENGD77_MD9600_DESCRIPTOR } from './md9600/descriptor.ts';
export {
  countWriteEligibleSatelliteRecords as countOpenGd77WriteEligibleSatellites,
  listCapabilitySkippedTransmitters as listOpenGd77CapabilitySkippedTransmitters,
  overlaySatelliteBank,
  packSatelliteBank,
  previewSatelliteWriteRecords as previewOpenGd77SatelliteWriteRecords,
  skippedSatellites as skippedOpenGd77Satellites,
  type OpenGd77SatelliteWritePreviewEntry,
  type CapabilitySkippedTransmitter as OpenGd77CapabilitySkippedTransmitter,
} from './satelliteCodec.ts';
export { uploadOpenGd77SatelliteBank } from './satelliteWrite.ts';
export { encodeOpenGd77UserDatabase } from './userDatabaseCodec.ts';
