/**
 * Firmware updater seam: a sibling of the codeplug `CloneImageRadio` contract.
 * A bootloader update is a one-way, precomputed frame stream with a destructive erase part-way through.
 * See DESIGN.md — Firmware flashing, and docs/features/firmware-flashing/.
 */
import type { FirmwareRadioId, StockFirmwareDescriptor } from '@core/firmware/types.ts';
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';

import type { BytePipe, ProgressFn, ProgressUpdate } from '../types.ts';

export interface FirmwareLinkSpec {
  readonly baudRate: number;
  /** Narrows the picker. Identifies the cable / USB device, NOT whether the radio is in update mode. */
  readonly usbFilters: readonly { readonly usbVendorId: number; readonly usbProductId?: number }[];
  readonly raiseDtrRts: boolean;
}

export interface FirmwareBootloaderIdent {
  readonly radioId: FirmwareRadioId;
  readonly model: string;
  readonly version?: string;
  readonly raw: Uint8Array;
  /** Operator text the wizard shows once this ident is known (for example, that Studio is continuing a cut update). */
  readonly notice?: string;
}

/**
 * `loader` is for a radio whose own loader takes over before it says what it will do (UV-5R Mini): it is shown only
 * once reported, and `erase` only once the radio has announced an erase.
 */
export type FirmwareFlashPhase = 'handshake' | 'loader' | 'erase' | 'transfer' | 'finish';

export interface FirmwareFlashProgress extends ProgressUpdate {
  readonly phase: FirmwareFlashPhase;
  /** True from the first erase-capable frame onward: an abort now leaves the radio needing a re-flash. */
  readonly radioTouched: boolean;
}

export type FirmwareFlashEnd = 'eot-sent' | 'acknowledged' | 'port-closed-by-radio' | 'no-reply';

/** Per data frame, write to acknowledgement, in milliseconds. */
export interface FirmwareFlashTiming {
  readonly medianFrameMs: number;
  readonly p99FrameMs: number;
  readonly maxFrameMs: number;
}

export interface FirmwareFlashResult {
  readonly framesSent: number;
  readonly dataFrames: number;
  readonly elapsedMs: number;
  readonly end: FirmwareFlashEnd;
  /** Set by updaters that time each data frame's round trip. */
  readonly timing?: FirmwareFlashTiming;
  /** Operator text the wizard shows with the success banner (what the radio does next, what to check). */
  readonly note?: string;
}

export interface FirmwareUpdater {
  readonly radioId: FirmwareRadioId;
  readonly link: FirmwareLinkSpec;
  /** Pure hard interlocks on the image. Throws RadioInterlockError. Nothing about it is configurable. */
  checkImage(image: PreparedFirmwareImage): void;
  /** Non-destructive handshake up to and including the bootloader ident. Binds `pipe` for flash(). */
  identify(pipe: BytePipe, opts?: { signal?: AbortSignal }): Promise<FirmwareBootloaderIdent>;
  /**
   * Re-runs checkImage, checks ident against image, precomputes every frame, then sends. A radio-driven updater (the
   * radio picks the slices) precomputes the checked image instead, and every reply is a pure function of it.
   * Must follow identify() straight away in the same session, without waiting for user input.
   * Every failure is thrown as FirmwareFlashError.
   */
  flash(
    image: PreparedFirmwareImage,
    opts: { onProgress?: (p: FirmwareFlashProgress) => void; signal?: AbortSignal },
  ): Promise<FirmwareFlashResult>;
}

export interface FirmwarePreflightAttestation {
  readonly id: string;
  readonly label: string;
  /** How to check, one or two sentences. */
  readonly help?: string;
}

export interface FirmwarePreflightProbeResult {
  /** Shown to the operator, e.g. 'RT95-P, version V100'. */
  readonly summary: string;
}

/** A read-only check of the radio in NORMAL mode, before update mode. Throws RadioIoError to refuse. */
export interface FirmwarePreflightProbe {
  readonly title: string;
  readonly steps: readonly string[];
  readonly link: FirmwareLinkSpec;
  run(pipe: BytePipe, opts: { signal?: AbortSignal }): Promise<FirmwarePreflightProbeResult>;
}

/** Result of a safety-backup step. `radioKey` is the normalised serial the operator typed from the radio's label. */
export type FirmwareSafetyBackupOutcome =
  | { readonly kind: 'already-saved'; readonly radioKey: string; readonly summary: string }
  | {
      readonly kind: 'taken';
      readonly radioKey: string;
      /** e.g. 'RT95-P V100, calibration region, fingerprint 1a2b3c4d'. */
      readonly summary: string;
      readonly region: string;
      readonly fileName: string;
      readonly zipBytes: Uint8Array;
      readonly sha256: string;
      readonly fingerprint: string;
    };

/** A backup file the operator already has, checked. */
export interface FirmwareSafetyBackupFileInfo {
  readonly radioKey: string;
  readonly region: string;
  readonly fileName: string;
  readonly sha256: string;
  readonly fingerprint: string;
  readonly summary: string;
}

/**
 * A required "a safety backup of this radio's irreplaceable data is saved" step on Before you flash. Once per
 * radio, any age. "This radio" is the serial number the operator types from the label (never read from the radio).
 */
export interface FirmwarePreflightSafetyBackup {
  readonly title: string;
  /** One paragraph of operator copy. */
  readonly why: string;
  /** e.g. switch on normally, connect the cable. */
  readonly steps: readonly string[];
  /** Normal-mode link (may differ from the update link). */
  readonly link: FirmwareLinkSpec;
  readonly expectedDuration: string;
  /** Record family in browser storage, e.g. 'retevis-rt95'. */
  readonly recordFamily: string;
  /** Hint under the serial field, e.g. where the label is. */
  readonly serialHint: string;
  /** Trim, uppercase, collapse whitespace; '' means invalid. The one place that says which radio a record is for. */
  normaliseSerial(text: string): string;
  /**
   * Read-only. Identifies the radio, then when isSaved(radioKey) is true returns 'already-saved' and reads nothing
   * more. `serial` is as typed; `radioKey` is `normaliseSerial(serial)`.
   */
  run(
    pipe: BytePipe,
    opts: {
      serial: string;
      radioKey: string;
      signal?: AbortSignal;
      onProgress?: ProgressFn;
      isSaved: (radioKey: string) => boolean;
    },
  ): Promise<FirmwareSafetyBackupOutcome>;
  /**
   * Verify a backup file the operator already has; throws on a bad file. `fallbackSerial` (as typed) is used when
   * the file carries none; throws when neither has one.
   */
  verifyFile(
    bytes: Uint8Array,
    opts: { fallbackSerial: string },
  ): Promise<FirmwareSafetyBackupFileInfo>;
}

export interface FirmwareRadioPreflight {
  readonly attestations: readonly FirmwarePreflightAttestation[];
  readonly probe?: FirmwarePreflightProbe;
  /** Required before the flash: a saved safety backup for this radio. The probe opt-out does not skip it. */
  readonly safetyBackup?: FirmwarePreflightSafetyBackup;
  /** When set, a confirmation ticked on the Flash step, right before Connect and flash. */
  readonly updateModeConfirm?: string;
}

/**
 * Whether the Android app (Capacitor) offers a radio's flasher (#1367):
 * - `false`: hidden on the Android app.
 * - `'developerMode'`: offered on the Android app only while developer mode is on for the device, in any build (#1657).
 *   Visibility only, like every developer-mode gate: no interlock reads it. No radio uses it today (the UV-5R Mini
 *   moved to `true` in #1671); kept for a radio whose phone flash is not yet proven.
 * - `true`: offered on the Android app, after a full flash there has been proven on hardware.
 */
export type FirmwareCapacitorSupport = boolean | 'developerMode';

export interface FirmwareUpdaterDescriptor {
  readonly radioId: FirmwareRadioId;
  readonly label: string;
  readonly stock: StockFirmwareDescriptor;
  readonly link: FirmwareLinkSpec;
  /** One instance per session. */
  readonly createUpdater: () => FirmwareUpdater;
  /** Whether the Android app offers this radio: see {@link FirmwareCapacitorSupport}. */
  readonly capacitorSupported: FirmwareCapacitorSupport;
  /**
   * Hidden on the PROD build while true; next/dev/staging unaffected. Cleared once Studio has flashed at least
   * one patched release to this radio on hardware (the owner's hardware gate).
   */
  readonly prodFlashDisabled: boolean;
  /**
   * Radio-specific hard gate on the Before-you-flash step: every attestation ticked and, when present, the
   * probe passed.
   */
  readonly preflight?: FirmwareRadioPreflight;
  /**
   * For a radio whose firmware may report about itself (UV-5R Mini): the read-only normal-mode read Prepare runs before
   * update mode. Its bytes go to the stock descriptor's `radioLayout.report.resolve`.
   */
  readonly radioReport?: FirmwareRadioReportReader;
  /** Human text for the wizard, e.g. 'about 2 minutes'. */
  readonly expectedDuration: string;
}

/** Read-only: one handshake and one read in normal mode. Sends no write frame. */
export interface FirmwareRadioReportReader {
  readonly link: FirmwareLinkSpec;
  /** Tried once more at this rate when the handshake gets no answer at `link.baudRate`, as the codeplug session does. */
  readonly baudRateFallback?: number;
  read(pipe: BytePipe, opts: { signal?: AbortSignal }): Promise<Uint8Array>;
}
