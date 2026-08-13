/**
 * UV-21Pro V2 radio module barrel.
 */

export { UV21_PRO_V2_DESCRIPTOR, UV21_PRO_V2_MODEL_ID } from './descriptor.ts';
export { UV21_PRO_V2_LAYOUT } from '../uv17pro-family/layout.ts';
export {
  summariseUv21ProV2Clone,
  UV21_PRO_V2_CLONE_REGION_SUMMARIES,
  type Uv21ProV2CloneSummary,
  type Uv21ProV2OnRadioCounts,
  type Uv21ProV2RetainGroupSummary,
  type RadioCloneRegionSummary,
} from './cloneSummary.ts';
export {
  settingsRetainPreview,
  ancillaryRetainPreview,
  type Uv17ProRetainPreviewRow as Uv21ProV2RetainPreviewRow,
  type Uv17ProAncillaryRetainPreview as Uv21ProV2AncillaryRetainPreview,
} from '../uv17pro-family/retainPreview.ts';
export {
  UV17PRO_WRITTEN_FROM_BUILD_LABELS as UV21_WRITTEN_FROM_BUILD_LABELS,
  buildUv17ProRegionManifest as buildUv21RegionManifest,
  uv17ProKeptRegions as uv21KeptRegions,
  type Uv17ProRegionManifestEntry as Uv21RegionManifestEntry,
} from '../uv17pro-family/writeRole.ts';
export {
  decodeChannelsFromImage,
  encodeChannelsIntoImage,
  readFirmwareFromImage,
} from '../uv17pro-family/channelCodec.ts';
export { createUv17ProProtocol as createUv21ProV2Protocol } from '../uv17pro-family/protocol.ts';
export {
  uv17ProBackupMemSpans as uv21BackupMemSpans,
  type Uv17ProBackupMemSpan as Uv21BackupMemSpan,
} from '../uv17pro-family/backupRestoreRoles.ts';
