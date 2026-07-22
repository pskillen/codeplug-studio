/**
 * Browser radio I/O — Web Serial transport + reusable protocol kit.
 * Radio adapters land under radios/<id>/ in follow-up tickets (#617+).
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
  RadioDescriptor,
  RadioSession,
} from './types.ts';

export * from './kit/index.ts';
export * from './transport/index.ts';

// Optional BLE BytePipe (same interface) — deferred; see epic #594.
