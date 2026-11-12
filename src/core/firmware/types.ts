/**
 * Vendor-neutral firmware types. Generic code works on member roles and hashes; file names, sizes and
 * wire layouts live in each radio's `firmware.ts` and in `patch/formats/<patch-name>/`.
 * See DESIGN.md — Firmware flashing.
 */

export type FirmwareRadioId =
  | 'baofeng-dm32uv'
  | 'anytone-at-d890uv'
  | 'retevis-rt95-head'
  | 'retevis-rt95-main'
  | 'baofeng-uv5rmini';

/** A file the user gave us (or, later, a remote source fetched). Name is the basename only. */
export interface NamedBytes {
  readonly name: string;
  readonly bytes: Uint8Array;
}

export interface StockFirmwareMember {
  /** Stable role key used by patch formats and updaters. Declared per radio; generic code never hard-codes one. */
  readonly role: string;
  readonly fileName: string;
  readonly size: number;
  /** Lowercase hex. */
  readonly sha256: string;
}

/** Where an operator gets the stock files. Shown as text and plain links only; Studio never fetches any of them. */
export type StockFirmwareSource =
  | {
      readonly kind: 'download';
      readonly label: string; // 'Vendor download', 'Unofficial mirror'
      readonly url: string;
      readonly host: string;
      /** false: not run by the vendor; the wizard says so next to the link. */
      readonly official: boolean;
      readonly note?: string;
    }
  | {
      readonly kind: 'ask-vendor';
      readonly label: string; // 'Email Retevis support'
      readonly instructions: string;
      readonly contact?: { readonly text: string; readonly href: string }; // mailto: or https:
    }
  | { readonly kind: 'own-image'; readonly label: string; readonly instructions: string };

/** One more stock version a radio's patches may be built on. Same sources and hint as the descriptor that lists it. */
export interface StockFirmwareVariant {
  readonly version: string;
  readonly members: readonly StockFirmwareMember[];
}

export interface StockFirmwareDescriptor {
  readonly radioId: FirmwareRadioId;
  readonly label: string;
  readonly version: string;
  /** Where an operator gets the stock files, in display order (at least one). Shown as text and links only. */
  readonly stockSources: readonly StockFirmwareSource[];
  /** The vendor zip as published; absent when no zip is published. Member hashes are authoritative. */
  readonly zip?: { readonly fileName: string; readonly sha256: string };
  /** False hides plain stock flashing; defaults to true. */
  readonly stockFlashOffered?: boolean;
  readonly members: readonly StockFirmwareMember[];
  /**
   * Further stock versions accepted for the same radio, each its own member set. The patch's own `stock` hashes pick
   * the one in use; a user never chooses. Read through `stockVariants`, never directly.
   */
  readonly alsoAccepts?: readonly StockFirmwareVariant[];
  /** Patch `name` values whose releases apply to this radio. */
  readonly patchNames: readonly string[];
  /** Human-facing update-mode entry, rendered generically by the wizard. */
  readonly bootloaderEntry: {
    readonly steps: readonly string[];
    readonly indicator: string;
    readonly warnings: readonly string[];
  };
  /** How the operator confirms stock is running after a flash. */
  readonly stockVerifyHint: string;
}

/** Bytes keyed by member role. Stock and patched packages share this shape. */
export interface FirmwarePackage {
  readonly radioId: FirmwareRadioId;
  readonly files: Readonly<Record<string, Uint8Array>>;
}

export type FirmwareProvenance = 'stock' | 'published' | 'unreviewed';

/** Result hashes of a known patched build, so stock resolution can say "this is already-patched firmware". */
export interface KnownPatchedResult {
  readonly radioId: FirmwareRadioId;
  /** e.g. 'release 1.0.0' */
  readonly label: string;
  /** By role. */
  readonly sha256: Readonly<Record<string, string>>;
}
