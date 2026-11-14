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
      /**
       * The file this link gives, where it isn't the descriptor's zip or its own files (a radio with several stock
       * versions links each one). Shown as the link text.
       */
      readonly fileName?: string;
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
  /** See `StockFirmwareDescriptor.baseName`. */
  readonly baseName?: string;
  readonly members: readonly StockFirmwareMember[];
}

/**
 * A radio whose way back to stock is a to-stock release patch rather than the plain stock file. The wizard offers a
 * "Back to stock" choice that asks for that patch file.
 */
export interface StockReturnPatch {
  /** One line: where the to-stock patch comes from and why the plain stock file can't be flashed. */
  readonly help: string;
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
  /**
   * The name a release patch gives this stock in `base`, for formats that name one (UV-5R Mini `nrfb-v0.04`). A patch
   * whose build name is this name, built on this stock, is a to-stock patch: it installs this stock.
   */
  readonly baseName?: string;
  /** Set where the way back to stock is a to-stock release patch (see `StockReturnPatch`). */
  readonly stockReturn?: StockReturnPatch;
  readonly members: readonly StockFirmwareMember[];
  /**
   * Further stock versions accepted for the same radio, each its own member set. The patch's own `stock` hashes pick
   * the one in use; a user never chooses. Read through `stockVariants`, never directly.
   */
  readonly alsoAccepts?: readonly StockFirmwareVariant[];
  /**
   * Set where one release's files are built on different stock versions (UV-5R Mini: the L1 file on v0.04, the L2 file
   * on v0.27). The operator may then supply one file per stock version at once, and each patch is built on the stock
   * its own `base` names. Without it, files for more than one version are refused.
   */
  readonly severalStocks?: boolean;
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
  /**
   * For a radio whose firmware comes in more than one flash layout (the factory firmware's packing, not the board):
   * the question the wizard asks before Prepare, from the radio's Radio Info screen. The answer becomes `radioLayout`
   * on the prepared image.
   */
  readonly radioLayout?: FirmwareRadioLayoutQuestion;
  /**
   * For a radio whose releases ship one file per flash layout: the layouts a release file may be for, and how a
   * patch's build name names its layout. A release is one published row per layout; Studio picks the file for the
   * radio's layout at Prepare; the other is kept for a retry only when it has the same suffix (`variantOfBase`).
   */
  readonly releaseLayouts?: FirmwareReleaseLayouts;
}

/** The flash layouts a radio's release files are built for (see `StockFirmwareDescriptor.releaseLayouts`). */
export interface FirmwareReleaseLayouts {
  /** The release layouts, in the order Studio lists them (UV-5R Mini `L1`, `L2`). */
  readonly layouts: readonly string[];
  /**
   * The layout tag a patch's build name carries, or undefined when it carries none (a to-stock patch, an older
   * build). A tag outside `layouts` (a test-only build) is returned as is, for the caller to refuse.
   */
  readonly fromBuildName: (buildName: string) => string | undefined;
  /**
   * The radio variant a stock base is for (UV-5R Mini: the `NRF`/`NRFB` suffix, `nrf` or `nrfb`), where variants get
   * separate builds. The retry with a release's other file only goes to a file of the same variant.
   */
  readonly variantOfBase?: (base: string) => string | undefined;
}

/** What the operator gave from the radio's Radio Info screen. */
export interface RadioInfoAnswers {
  readonly firmware: string;
  readonly hardware: string;
  /** The suffix line, for a question that asks one (`FirmwareRadioLayoutQuestion.suffixLabel`). */
  readonly suffix?: string;
}

export type RadioLayoutAnswer =
  | { readonly kind: 'incomplete' }
  | {
      readonly kind: 'layout';
      readonly layout: string;
      /** The build the radio runs, where the radio said so itself; decides "already installed". */
      readonly build?: string;
      /**
       * Set when the answer is the radio's own report rather than its Radio Info lines. A radio that reports runs an
       * MM9PDY build, even when the report names none.
       */
      readonly reported?: true;
      /**
       * The stock base the radio's own code is built on (UV-5R Mini: from its report's flag, or its Radio Info suffix
       * and Firmware lines). Prepare picks the release file on this base, and the radio's interlocks refuse a file on
       * another one.
       */
      readonly codeBase?: string;
      /** Shown with the answer; it does not stop the wizard. */
      readonly warning?: string;
      /** What the radio said about itself, shown as information only. */
      readonly details?: readonly string[];
    }
  | { readonly kind: 'refused'; readonly message: string };

/** Rendered generically by the wizard's Prepare step. */
export interface FirmwareRadioLayoutQuestion {
  readonly intro: string;
  readonly steps: readonly string[];
  readonly firmwareLabel: string;
  readonly hardwareLabel: string;
  /**
   * The values the operator picks from, in order, where the lines are dropdowns of supported values rather than typed
   * (UV-5R Mini: Firmware `V0.04`, `V0.27`, `Other`; Hardware `V1.7`, `Other`).
   */
  readonly firmwareOptions?: readonly string[];
  readonly hardwareOptions?: readonly string[];
  /**
   * A third line, beside the Firmware version, for a radio whose builds also differ by a suffix (UV-5R Mini: `NRF`,
   * `NRFB`, `Other`). Asked only when set.
   */
  readonly suffixLabel?: string;
  readonly suffixOptions?: readonly string[];
  /** Where on the radio each line is shown, under its field. */
  readonly firmwareHelp?: string;
  readonly hardwareHelp?: string;
  readonly suffixHelp?: string;
  /** Shown with the question, before anything is picked: what a wrong pick does. */
  readonly warning?: string;
  readonly resolve: (answers: RadioInfoAnswers) => RadioLayoutAnswer;
  /**
   * For a radio whose firmware may report about itself: Prepare reads the radio first (the updater's `radioReport`)
   * and asks the question above only when there is no report. `resolve` returns null for no report.
   */
  readonly report?: {
    readonly intro: string;
    readonly steps: readonly string[];
    readonly resolve: (bytes: Uint8Array) => RadioLayoutAnswer | null;
  };
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
