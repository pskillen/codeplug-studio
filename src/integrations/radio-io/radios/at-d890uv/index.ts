/**
 * Anytone AT-D890UV radio module — sparse 16-byte selective clone.
 */

export {
  AT_D890_BLOCK_SIZE,
  AT_D890_CONNECTION,
  AT_D890_LIMITS,
  AT_D890UV_MODEL_IDS,
  D890_MAP,
} from './constants.ts';
export { createAtD890uvProtocol, AtD890uvProtocol, type AtD890DownloadCache } from './protocol.ts';
export { AT_D890UV_DESCRIPTOR, AT_D890UV_MODEL_ID } from './descriptor.ts';
export {
  extractAtD890uvHydration,
  extractAtD890uvHydrationFromProtocol,
  mergeChannelsIntoAtD890uvHydration,
  memoryMapFromAtD890uvHydration,
} from './hydration.ts';
export {
  decodeChannelsFromAtD890Cache,
  encodeChannelsIntoAtD890Image,
  parseAtD890ChannelRecord,
  encodeAtD890ChannelRecord,
} from './channelCodec.ts';
export {
  summariseAtD890uvClone,
  type AtD890uvCloneSummary,
  type AtD890RetainGroupSummary,
} from './cloneSummary.ts';
export {
  AT_D890_WRITTEN_FROM_BUILD_LABELS,
  AT_D890_DIGITAL_CONTACTS_WRITE_GAP,
  atD890WriteRole,
  atD890RegionLabel,
} from './writeRole.ts';
