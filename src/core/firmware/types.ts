/**
 * Vendor-neutral firmware types. Generic code works on member roles and hashes; file names, sizes and
 * wire layouts live in each radio's `firmware.ts` and in `patch/formats/<patch-name>/`.
 * See DESIGN.md — Firmware flashing.
 */

export type FirmwareRadioId = 'baofeng-dm32uv' | 'anytone-at-d890uv';

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

export interface StockFirmwareDescriptor {
  readonly radioId: FirmwareRadioId;
  readonly label: string;
  readonly version: string;
  /** Shown as a link only. Never fetched by Studio code. */
  readonly vendorDownload: { readonly url: string; readonly host: string; readonly note?: string };
  /** The vendor zip as published. Diagnostic: member hashes are authoritative. */
  readonly zip: { readonly fileName: string; readonly sha256: string };
  readonly members: readonly StockFirmwareMember[];
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

export type FirmwareProvenance = 'stock' | 'bundled' | 'unreviewed';

/** Result hashes of a known patched build, so stock resolution can say "this is already-patched firmware". */
export interface KnownPatchedResult {
  readonly radioId: FirmwareRadioId;
  /** e.g. 'release 1.0.0' */
  readonly label: string;
  /** By role. */
  readonly sha256: Readonly<Record<string, string>>;
}
