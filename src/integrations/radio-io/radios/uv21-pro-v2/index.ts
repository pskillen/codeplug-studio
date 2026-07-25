/**
 * UV-21Pro V2 radio module barrel.
 */

export {
  UV21_PRO_V2_DESCRIPTOR,
  UV21_PRO_V2_MODEL_ID,
} from './descriptor.ts';
export { UV21_PRO_V2_LAYOUT } from '../uv17pro-family/layout.ts';
export {
  summariseUv17ProClone as summariseUv21ProV2Clone,
  buildCloneRegionSummaries as buildUv21CloneRegionSummaries,
  type Uv17ProCloneSummary as Uv21ProV2CloneSummary,
  type Uv17ProOnRadioCounts as Uv21ProV2OnRadioCounts,
  type Uv17ProRetainGroupSummary as Uv21ProV2RetainGroupSummary,
  type RadioCloneRegionSummary,
} from '../uv17pro-family/cloneSummary.ts';
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
