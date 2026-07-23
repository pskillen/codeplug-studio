/**
 * Baofeng DM-32UV / DP570UV radio module — V-frame + 4KB block clone.
 */

export {
  DM32_BLOCK_SIZE,
  DM32_CONNECTION,
  DM32_METADATA,
  DM32_MODEL_IDS,
} from './constants.ts';
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
