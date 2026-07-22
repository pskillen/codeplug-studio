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
  decodeChannelsFromImage,
  encodeChannelsIntoImage,
  readFirmwareFromImage,
} from './channelCodec.ts';
export { UV5R_MINI_BAUD_RATE, UV5R_MINI_CHANNEL_COUNT, UV5R_MINI_MEM_TOTAL } from './constants.ts';
