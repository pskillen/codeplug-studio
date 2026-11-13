import type { FirmwarePackage } from '../types.ts';

export interface FirmwarePatchHashes {
  readonly sha256: string;
  readonly size: number;
}

/** Release metadata every format exposes. stock/result are keyed by member ROLE. */
export interface FirmwarePatchDescription {
  readonly name: string;
  readonly format: number;
  readonly version: string;
  /** The stock base's name, for formats that name one (UV-5R Mini). The patch's claim: radios check it against hashes. */
  readonly base?: string;
  /**
   * The build the result installs, for formats that declare one (UV-5R Mini `build.name`). A build name equal to the
   * base name marks a to-stock patch. The patch's claim: radios check it in their interlocks.
   */
  readonly buildName?: string;
  readonly stock: Readonly<Record<string, FirmwarePatchHashes>>;
  readonly result: Readonly<Record<string, FirmwarePatchHashes>>;
}

/** One release patch format (one patch `name`), modelled like an import format. */
export interface FirmwarePatchFormat<P> {
  /** The patch `name` field, e.g. the firmware project's name. */
  readonly name: string;
  /** Supported `format` versions. */
  readonly formats: readonly number[];
  /** Structural validation of untrusted JSON. Throws FirmwareError('patch-malformed' | 'patch-unknown-format'). */
  parse(json: unknown): P;
  describe(p: P): FirmwarePatchDescription;
  /** Pure: verify stock, apply, verify result. Never mutates `stock`. Output radioId = stock.radioId. */
  apply(stock: FirmwarePackage, p: P): Promise<FirmwarePackage>;
  /** Optional: the tag stamped into the result image, for the flash summary. */
  readVersionStamp?(result: FirmwarePackage, p: P): string | undefined;
}

export interface ParsedFirmwarePatch {
  readonly format: FirmwarePatchFormat<unknown>;
  readonly patch: unknown;
  readonly description: FirmwarePatchDescription;
}
