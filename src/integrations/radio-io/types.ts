/**
 * Shared contracts for browser radio I/O (transport + protocol kit).
 * See docs/features/radio-read-write/protocol-kit-architecture.md §2.
 */

import type { RadioChannelDto } from './radioChannelDto.ts';
import type { RadioWriteOrganisation } from './radioWriteProjection.ts';

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
  /**
   * Checklist label for the current work set (e.g. "Channels", "Zones").
   * UI may accumulate these as extra progress list items during transfer.
   */
  stage?: string;
}

export type ProgressFn = (p: ProgressUpdate) => void;

/**
 * One step an adapter expects to emit during an operation, declared before any byte moves
 * so the UI can show the whole list up front (workflow design §2.5, #1393).
 */
export interface PlannedStage {
  /** Exactly the `ProgressUpdate.stage` string the adapter emits. */
  readonly label: string;
  /** Estimated bytes on the wire for this stage (reads and writes). Drives the overall bar and ETA. */
  readonly weight: number;
  /** May not occur in a given run (for example nothing to preserve). */
  readonly optional?: boolean;
  /**
   * The adapter emits this label in this many passes, `cur` restarting at 0 each time (for
   * example the DM-32UV pre-write read, one pass per block group). Default 1.
   */
  readonly passes?: number;
  /**
   * `cur`/`max` of this stage's events is a step index, not progress inside the stage (the D890
   * download emits one event per stage). The UI shows no per-step bar and counts the stage when
   * it completes.
   */
  readonly coarse?: boolean;
}

export type RadioOperation = 'read' | 'write' | 'backup' | 'restore';

/** What an adapter may use to size a plan. Everything is optional; plans fall back to nominal sizes. */
export interface RadioPlanContext {
  /** Write: the prepared projection (channels + organisation). */
  readonly prepared?: {
    readonly channels: readonly RadioChannelDto[];
    readonly organisation: RadioWriteOrganisation;
  };
  /** Write: which parts are being written. Omitted means the codeplug alone. */
  readonly parts?: {
    readonly codeplug: boolean;
    readonly contacts: boolean;
    readonly settings: boolean;
    readonly keps: boolean;
  };
  /** After an in-session read, adapters may refine weights from what they read. */
  readonly session?: RadioSession;
}

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
  /**
   * Merge modelled channels (and optional organisation) into a hydrated clone image.
   * Radios without zones/lists ignore {@link organisation}.
   */
  mergeChannelsIntoHydration(
    bag: import('@core/models/radioCloneHydration.ts').RadioCloneHydrationBag,
    channels: readonly import('./radioChannelDto.ts').RadioChannelDto[],
    organisation?: import('./radioWriteProjection.ts').RadioWriteOrganisation,
  ): MemoryMap;
  /**
   * Optional: re-bind protocol upload state from a prior Read hydration.
   * Sparse radios (DM-32UV) need absolute block addresses after a fresh
   * connect — download cache is empty until this runs.
   */
  seedProtocolForUpload?(
    protocol: CloneImageRadio,
    bag: import('@core/models/radioCloneHydration.ts').RadioCloneHydrationBag | undefined,
    organisation?: import('./radioWriteProjection.ts').RadioWriteOrganisation,
    /** Slot-aligned Write projection channels (AT-D890UV channel location table). */
    channels?: readonly import('./radioChannelDto.ts').RadioChannelDto[],
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
  /** Upload strategy — Write still overlays this PROGRAM session, never a blank image. */
  writeStrategy: RadioWriteStrategy;
  /**
   * When true, direct serial Write is hidden on production deploys and warned in pre-prod.
   * App layer evaluates {@link __BUILD_ENV__}; adapter code stays registered.
   */
  prodWriteDisabled?: boolean;
  /** Baud for Web Serial open (radio-specific). */
  baudRate: number;
  /** Optional second baud to try once when ident/handshake fails at {@link baudRate}. */
  baudRateFallback?: number;
  /** Persist / merge clone image for this radio family. */
  hydration: RadioHydrationHooks;
  /**
   * Planned stages for an operation, in emission order, before any transfer. Labels must equal the
   * `stage` strings the adapter emits (a test per adapter replays a scripted Write and checks the
   * emitted labels against the plan, in order). A label emitted twice with other stages between
   * appears twice in the plan; the UI matches occurrences in order.
   * Omit for an operation without a plan: the UI falls back to a list that grows as stages arrive.
   */
  planStages?(op: RadioOperation, ctx: RadioPlanContext): PlannedStage[];
  /**
   * How long the radio is known to stay in programming mode with the session open and idle, in ms
   * (the Write stepper's Review step holds the session while the user reads). `Infinity` when the
   * radio has no timeout of its own (AT-D890UV). Unset means unknown: the stepper treats it as
   * `DEFAULT_PROGRAM_HOLD_SAFE_MS` and reconnects and re-reads before transmitting after that.
   */
  programHoldSafeMs?: number;
  /** Optional cross-session write verify — compare staged upload vs post-commit read-back. */
  writeVerify?: import('./writeVerify.ts').WriteVerifyHooks;
}

/**
 * Clone-image radio: download fills a MemoryMap; decode offline;
 * upload writes ranges (often after re-ident).
 * Concrete implementations live under radios/<id>/ (#617+).
 */
export interface CloneImageRadio {
  connect(
    pipe: BytePipe,
    opts?: {
      signal?: AbortSignal;
      settleScale?: number;
      handshake?: 'read' | 'none';
      /**
       * DM-32UV backup only. When set, that protocol reads the program-flash
       * factory sector twice. Other radios ignore this. Write and Restore leave it unset.
       */
      captureFactorySector?: boolean;
    },
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
  /**
   * Replay restorable backup regions onto the live pipe. Missing → Backup/Restore
   * inspect only. Must not call assemble / prepareRadioWriteImage.
   */
  restoreFromBackup?(
    archive: {
      manifest: import('./backup/types.ts').RadioBackupManifestV1;
      image: MemoryMap;
    },
    opts: { regionIds: readonly string[]; onProgress?: ProgressFn; signal?: AbortSignal },
  ): Promise<void>;
}

export interface RadioSession {
  readonly descriptor: RadioDescriptor;
  readonly pipe: BytePipe;
  readonly radio: CloneImageRadio;
  /** Optional cached image so settings survive partial rewrite. */
  cachedImage?: MemoryMap;
}
