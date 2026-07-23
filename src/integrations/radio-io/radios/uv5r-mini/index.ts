/**
 * UV-5R Mini radio module barrel.
 */

export { UV5R_MINI_DESCRIPTOR, UV5R_MINI_MODEL_ID } from './descriptor.ts';
export { createUv5rMiniProtocol, Uv5rMiniProtocol } from './protocol.ts';
export {
  extractUv5rMiniHydration,
  mergeChannelsIntoUv5rMiniHydration,
  memoryMapFromUv5rMiniHydration,
} from './hydration.ts';
export {
  summariseUv5rMiniClone,
  UV5R_MINI_CLONE_REGION_SUMMARIES,
  type Uv5rMiniCloneSummary,
  type Uv5rMiniOnRadioCounts,
  type Uv5rMiniRetainGroupSummary,
  type RadioCloneRegionSummary,
} from './cloneSummary.ts';
export {
  settingsRetainPreview,
  ancillaryRetainPreview,
  type Uv5rMiniRetainPreviewRow,
  type Uv5rMiniAncillaryRetainPreview,
} from './retainPreview.ts';
export {
  UV5R_MINI_WRITTEN_FROM_BUILD_LABELS,
  UV5R_MINI_REGION_MANIFEST,
  uv5rMiniWriteRole,
  type Uv5rMiniRegionId,
  type Uv5rMiniWriteRole,
} from './writeRole.ts';
export {
  decodeChannelsFromImage,
  encodeChannelsIntoImage,
  readFirmwareFromImage,
} from './channelCodec.ts';
export { UV5R_MINI_BAUD_RATE, UV5R_MINI_CHANNEL_COUNT, UV5R_MINI_MEM_TOTAL } from './constants.ts';
