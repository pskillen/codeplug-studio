/**
 * Firmware updater seam: a sibling of the codeplug `CloneImageRadio` contract.
 * A bootloader update is a one-way, precomputed frame stream with a destructive erase part-way through.
 * See DESIGN.md — Firmware flashing, and docs/features/firmware-flashing/.
 */
import type { FirmwareRadioId, StockFirmwareDescriptor } from '@core/firmware/types.ts';
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';

import type { BytePipe, ProgressUpdate } from '../types.ts';

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
}

export type FirmwareFlashPhase = 'handshake' | 'erase' | 'transfer' | 'finish';

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
}

export interface FirmwareUpdater {
  readonly radioId: FirmwareRadioId;
  readonly link: FirmwareLinkSpec;
  /** Pure hard interlocks on the image. Throws RadioInterlockError. Nothing about it is configurable. */
  checkImage(image: PreparedFirmwareImage): void;
  /** Non-destructive handshake up to and including the bootloader ident. Binds `pipe` for flash(). */
  identify(pipe: BytePipe, opts?: { signal?: AbortSignal }): Promise<FirmwareBootloaderIdent>;
  /**
   * Re-runs checkImage, checks ident against image, precomputes every frame, then sends.
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

export interface FirmwareRadioPreflight {
  readonly attestations: readonly FirmwarePreflightAttestation[];
  readonly probe?: FirmwarePreflightProbe;
}

export interface FirmwareUpdaterDescriptor {
  readonly radioId: FirmwareRadioId;
  readonly label: string;
  readonly stock: StockFirmwareDescriptor;
  readonly link: FirmwareLinkSpec;
  /** One instance per session. */
  readonly createUpdater: () => FirmwareUpdater;
  /** Hidden on Capacitor until supported end to end (follow-up #1367). */
  readonly capacitorSupported: boolean;
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
  /** Human text for the wizard, e.g. 'about 2 minutes'. */
  readonly expectedDuration: string;
}
