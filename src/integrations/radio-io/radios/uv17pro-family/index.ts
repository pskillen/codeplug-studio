/**
 * UV-17Pro PROGRAM+R/W family module barrel.
 */

export {
  UV5R_MINI_LAYOUT,
  UV21_PRO_V2_LAYOUT,
  type Uv17ProLayout,
  type Uv17ProRetainRegion,
} from './layout.ts';
export { buildUv17ProMagics, type Uv17ProMagicSet } from './magics.ts';
export { uv17ProCrypt } from './crypt.ts';
export {
  decodeBcdFreq,
  encodeBcdFreq,
  decodeTone,
  encodeTone,
  decodeChannelRecord,
  encodeChannelRecord,
  decodeChannelsFromImage,
  encodeChannelsIntoImage,
  readFirmwareFromImage,
  UV17PRO_SCAN_BIT,
  UV17PRO_WIDE_BIT,
} from './channelCodec.ts';
export {
  createUv17ProProtocol,
  Uv17ProProtocol,
  type Uv17ProConnectOptions,
} from './protocol.ts';
export {
  extractUv17ProHydration,
  memoryMapFromUv17ProHydration,
  mergeChannelsIntoUv17ProHydration,
} from './hydration.ts';
export {
  UV17PRO_WRITTEN_FROM_BUILD_LABELS,
  buildUv17ProRegionManifest,
  uv17ProKeptRegions,
  uv17ProWriteRole,
  type Uv17ProWriteRole,
  type Uv17ProRegionManifestEntry,
} from './writeRole.ts';
export {
  settingsRetainPreview,
  ancillaryRetainPreview,
  type Uv17ProRetainPreviewRow,
  type Uv17ProAncillaryRetainPreview,
} from './retainPreview.ts';
export {
  summariseUv17ProClone,
  buildCloneRegionSummaries,
  type Uv17ProCloneSummary,
  type Uv17ProOnRadioCounts,
  type Uv17ProRetainGroupSummary,
  type RadioCloneRegionSummary,
} from './cloneSummary.ts';
