/**
 * Baofeng DM-32UV / DP570UV radio module — V-frame + 4KB block clone.
 */

export { DM32_BLOCK_SIZE, DM32_CONNECTION, DM32_METADATA, DM32_MODEL_IDS } from './constants.ts';
export {
  createDm32uvProtocol,
  Dm32uvProtocol,
  memoryMapToDm32Blocks,
  type Dm32DownloadCache,
} from './protocol.ts';
export {
  classifyDm32Metadata,
  discoverDm32MemoryBlocks,
  selectBlocksToBulkRead,
  type Dm32DiscoveredBlock,
} from './memory.ts';
export {
  dm32AsciiHandshake,
  dm32EnterProgrammingMode,
  dm32ReadMemory,
  dm32WriteMemory,
  makeDm32ReadFrame,
  makeDm32WriteFrame,
} from './connection.ts';
export { DM32UV_DESCRIPTOR, DM32UV_MODEL_ID } from './descriptor.ts';
export {
  extractDm32uvHydration,
  extractDm32uvHydrationFromProtocol,
  mergeChannelsIntoDm32uvHydration,
  memoryMapFromDm32uvHydration,
} from './hydration.ts';
export {
  decodeChannelsFromDm32Image,
  encodeChannelsIntoDm32Image,
  parseDm32ChannelRecord,
  encodeDm32ChannelRecord,
} from './channelCodec.ts';
export { encodeDm32Zone, encodeZonesIntoDm32Image } from './zoneCodec.ts';
export { encodeDm32ScanList, encodeScanListsIntoDm32Image } from './scanListCodec.ts';
export {
  summariseDm32uvClone,
  type Dm32uvCloneSummary,
  type Dm32RetainGroupSummary,
  type Dm32RequiredBlockStatus,
} from './cloneSummary.ts';
export {
  dm32WriteRole,
  dm32BlockLabel,
  dm32ChannelBankAddresses,
  DM32_WRITTEN_FROM_BUILD_LABELS,
  type Dm32WriteRole,
} from './writeRole.ts';
