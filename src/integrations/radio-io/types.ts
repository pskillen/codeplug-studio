/**
 * Shared contracts for browser radio I/O (transport + protocol kit).
 * See docs/features/radio-read-write/protocol-kit-architecture.md §2.
 */

/** Contiguous clone-image buffer — layout offsets belong in radio modules. */
export interface MemoryMap {
  readonly size: number;
  /** Live backing store (mutations via set/fill are visible here). */
  readonly bytes: Uint8Array;
  get(offset: number, length: number): Uint8Array;
  set(offset: number, data: Uint8Array): void;
  fill(offset: number, length: number, value: number): void;
}

/** Browser-agnostic byte pipe — Web Serial and BLE both implement this. */
export interface BytePipe {
  readonly baudRate?: number;
  write(data: Uint8Array): Promise<void>;
  /** Block until `n` bytes or throw typed timeout / closed errors. */
  readExact(n: number, timeoutMs: number): Promise<Uint8Array>;
  flush?(): Promise<void>;
  close(): Promise<void>;
}

export interface ProgressUpdate {
  cur: number;
  max: number;
  msg: string;
}

export type ProgressFn = (p: ProgressUpdate) => void;

export interface IdentResult {
  raw: Uint8Array;
  firmwareHint?: string;
  modelHints?: string[];
}

/** Pluggable wire framing — not radio-specific memory layout. */
export interface BlockCodec {
  readonly name: string;
  makeReadFrame(addr: number, length: number): Uint8Array;
  makeWriteFrame(addr: number, length: number, payload: Uint8Array): Uint8Array;
  parseReadReply?(frame: Uint8Array): Uint8Array;
}

export interface RadioCapabilities {
  maxChannels: number;
  supportsZones: boolean;
  supportsScanLists: boolean;
  analogOnly: boolean;
  supportsBle?: boolean;
  supportsBulkRead?: boolean;
}

/** How Studio must write modelled data back to the radio. */
export type RadioWriteStrategy = 'selective-ranges' | 'full-image';

/** Format build profiles this radio adapter can pair with. */
export interface RadioCompatibleProfile {
  formatId: string;
  profileId: string;
}

/**
 * Per-radio bridge between MemoryMap and egress radio-clone hydration.
 * App session calls these instead of importing concrete radio modules.
 */
export interface RadioHydrationHooks {
  extractHydration(
    image: MemoryMap,
    meta?: {
      sourceFileName?: string;
      capturedAt?: string;
      /** Active protocol — sparse radios may read download cache from here. */
      protocol?: CloneImageRadio;
    },
  ): import('@core/models/radioCloneHydration.ts').RadioCloneHydrationBag;
  mergeChannelsIntoHydration(
    bag: import('@core/models/radioCloneHydration.ts').RadioCloneHydrationBag,
    channels: readonly import('./radioChannelDto.ts').RadioChannelDto[],
  ): MemoryMap;
  /**
   * Optional: re-bind protocol upload state from a prior Read hydration.
   * Sparse radios (DM-32UV) need absolute block addresses after a fresh
   * connect — download cache is empty until this runs.
   */
  seedProtocolForUpload?(
    protocol: CloneImageRadio,
    bag: import('@core/models/radioCloneHydration.ts').RadioCloneHydrationBag,
  ): void;
}

export interface RadioDescriptor {
  modelIds: readonly string[];
  label: string;
  group?: string;
  supportsBle: boolean;
  protocolFactory: () => CloneImageRadio;
  capabilities: RadioCapabilities;
  /** Keys into Studio attributions lib (#597). */
  attributionIds: readonly string[];
  /** Egress profiles eligible for connect / read / write. */
  compatibleProfiles: readonly RadioCompatibleProfile[];
  /** Upload strategy — full-image radios require prior Read hydration. */
  writeStrategy: RadioWriteStrategy;
  /** When true, Write is blocked until egress has binary hydration from Read. */
  hydrationRequiredForWrite: boolean;
  /** Baud for Web Serial open (radio-specific). */
  baudRate: number;
  /** Optional second baud to try once when ident/handshake fails at {@link baudRate}. */
  baudRateFallback?: number;
  /** Persist / merge clone image for this radio family. */
  hydration: RadioHydrationHooks;
}

/**
 * Clone-image radio: download fills a MemoryMap; decode offline;
 * upload writes ranges (often after re-ident).
 * Concrete implementations live under radios/<id>/ (#617+).
 */
export interface CloneImageRadio {
  connect(
    pipe: BytePipe,
    opts?: { signal?: AbortSignal; settleScale?: number; handshake?: 'read' | 'none' },
  ): Promise<IdentResult>;
  disconnect(): Promise<void>;
  download(opts: { onProgress?: ProgressFn; signal?: AbortSignal }): Promise<MemoryMap>;
  upload(image: MemoryMap, opts: { onProgress?: ProgressFn; signal?: AbortSignal }): Promise<void>;
  decodeChannels(image: MemoryMap): import('./radioChannelDto.ts').RadioChannelDto[];
  encodeChannels(
    image: MemoryMap,
    channels: readonly import('./radioChannelDto.ts').RadioChannelDto[],
  ): MemoryMap;
  readFirmware(image: MemoryMap): string | undefined;
}

export interface RadioSession {
  readonly descriptor: RadioDescriptor;
  readonly pipe: BytePipe;
  readonly radio: CloneImageRadio;
  /** Optional cached image so settings survive partial rewrite. */
  cachedImage?: MemoryMap;
}
