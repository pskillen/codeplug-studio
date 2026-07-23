/**
 * Browser radio I/O — Web Serial transport + reusable protocol kit + radio registry.
 *
 * Architecture: docs/features/radio-read-write/protocol-kit-architecture.md
 */

export type {
  BlockCodec,
  BytePipe,
  CloneImageRadio,
  IdentResult,
  MemoryMap,
  ProgressFn,
  ProgressUpdate,
  RadioCapabilities,
  RadioCompatibleProfile,
  RadioDescriptor,
  RadioSession,
  RadioWriteStrategy,
} from './types.ts';

export type { RadioChannelDto, RadioTone } from './radioChannelDto.ts';

export * from './kit/index.ts';
export * from './transport/index.ts';
export {
  getRadioDescriptor,
  isProfileCompatibleWithAnyRadio,
  listDescriptorsForProfile,
  listRadioDescriptors,
} from './registry.ts';
export {
  UV5R_MINI_DESCRIPTOR,
  UV5R_MINI_MODEL_ID,
  createUv5rMiniProtocol,
  extractUv5rMiniHydration,
  mergeChannelsIntoUv5rMiniHydration,
  memoryMapFromUv5rMiniHydration,
  summariseUv5rMiniClone,
} from './radios/uv5r-mini/index.ts';

// Optional BLE BytePipe (same interface) — deferred; see epic #594.
