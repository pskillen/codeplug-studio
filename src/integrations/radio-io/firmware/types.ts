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

export interface FirmwareFlashResult {
  readonly framesSent: number;
  readonly dataFrames: number;
  readonly elapsedMs: number;
  readonly end: FirmwareFlashEnd;
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
  /** Human text for the wizard, e.g. 'about 2 minutes'. */
  readonly expectedDuration: string;
}
