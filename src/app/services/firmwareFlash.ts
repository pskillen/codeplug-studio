/**
 * Thin orchestration for the firmware flasher. No protocol or radio knowledge: radio facts come from descriptors,
 * verification from core, frames from the radio's updater. Nothing here is persisted. See DESIGN.md — Firmware
 * flashing and docs/features/firmware-flashing/.
 */
import { FirmwareError } from '@core/firmware/errors.ts';
import { listKnownPatchedResults } from '@core/firmware/releases/index.ts';
import {
  resolveStockFirmware,
  type VerifiedStockFirmware,
} from '@core/firmware/stock/resolveStockFirmware.ts';
import {
  getStockFirmwareDescriptor,
  listStockFirmwareDescriptors,
} from '@core/firmware/stockCatalog.ts';
import type { FirmwareRadioId, NamedBytes } from '@core/firmware/types.ts';
import {
  prepareFirmwareImage,
  type PreparedFirmwareImage,
} from '@core/services/firmware/prepareFirmwareImage.ts';
import {
  FirmwareFlashError,
  getFirmwareUpdater,
  openWebSerialPipe,
  RadioIoError,
  requestWebSerialPort,
  type BytePipe,
  type FirmwareBootloaderIdent,
  type FirmwareFlashProgress,
  type FirmwareFlashResult,
  type FirmwareUpdaterDescriptor,
  type SerialPortLike,
} from '@integrations/radio-io';

export type { VerifiedStockFirmware };

function requireUpdater(radioId: FirmwareRadioId): FirmwareUpdaterDescriptor {
  const d = getFirmwareUpdater(radioId);
  if (!d) throw new Error(`No firmware updater is registered for ${radioId}.`);
  return d;
}

export async function filesToNamedBytes(files: readonly File[]): Promise<NamedBytes[]> {
  return Promise.all(
    files.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })),
  );
}

/** Verify user-supplied stock against the radio's pins. Throws FirmwareError with an operator message. */
export async function verifyStockFiles(
  radioId: FirmwareRadioId,
  files: readonly NamedBytes[],
): Promise<VerifiedStockFirmware> {
  const descriptor = getStockFirmwareDescriptor(radioId);
  const others = listStockFirmwareDescriptors().filter((d) => d.radioId !== radioId);
  return resolveStockFirmware(descriptor, files, {
    otherDescriptors: others,
    knownPatchedResults: listKnownPatchedResults(radioId),
  });
}

/** Build the stock image, then run the updater's interlocks before any radio contact. */
export async function prepareStockFlash(
  radioId: FirmwareRadioId,
  stock: VerifiedStockFirmware,
): Promise<PreparedFirmwareImage> {
  const image = await prepareFirmwareImage({
    descriptor: getStockFirmwareDescriptor(radioId),
    stock,
    target: { kind: 'stock' },
  });
  requireUpdater(radioId).createUpdater().checkImage(image);
  return image;
}

/** Always a fresh pick, narrowed to the radio's cable. Call from a user gesture. */
export async function grantFirmwarePort(radioId: FirmwareRadioId): Promise<SerialPortLike> {
  return requestWebSerialPort(true, requireUpdater(radioId).link.usbFilters);
}

export type FirmwareFlashOutcome =
  | {
      ok: true;
      radioId: FirmwareRadioId;
      image: PreparedFirmwareImage;
      ident: FirmwareBootloaderIdent;
      result: FirmwareFlashResult;
      startedAt: string;
    }
  | {
      ok: false;
      radioId: FirmwareRadioId;
      image: PreparedFirmwareImage;
      ident?: FirmwareBootloaderIdent;
      code: string;
      message: string;
      position: string;
      radioTouched: boolean;
      startedAt: string;
    };

function errorCode(err: unknown): string {
  if (err instanceof RadioIoError || err instanceof FirmwareError) return err.code;
  return 'unknown';
}

function errorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'The firmware update failed.';
}

/**
 * Open the port, identify the bootloader, flash, and always close the port. Never throws for flash failures:
 * every outcome is returned. Failures before the ident completes report `radioTouched: false`.
 */
export async function runFirmwareFlash(input: {
  radioId: FirmwareRadioId;
  image: PreparedFirmwareImage;
  port: SerialPortLike;
  onIdent?: (ident: FirmwareBootloaderIdent) => void;
  onProgress: (p: FirmwareFlashProgress) => void;
  signal: AbortSignal;
}): Promise<FirmwareFlashOutcome> {
  const { radioId, image, port, signal } = input;
  const startedAt = new Date().toISOString();
  let pipe: BytePipe | null = null;
  let ident: FirmwareBootloaderIdent | undefined;
  let stage = 'connect';
  try {
    const descriptor = requireUpdater(radioId);
    pipe = await openWebSerialPipe(port, descriptor.link.baudRate);
    const updater = descriptor.createUpdater();
    stage = 'identify';
    ident = await updater.identify(pipe, { signal });
    input.onIdent?.(ident);
    stage = 'flash';
    const result = await updater.flash(image, { onProgress: input.onProgress, signal });
    return { ok: true, radioId, image, ident, result, startedAt };
  } catch (err) {
    const flashErr = err instanceof FirmwareFlashError ? err : null;
    return {
      ok: false,
      radioId,
      image,
      ident,
      code: errorCode(err),
      message: errorMessage(err),
      position: flashErr?.position ?? stage,
      radioTouched: flashErr?.radioTouched ?? false,
      startedAt,
    };
  } finally {
    if (pipe) {
      try {
        await pipe.close();
      } catch {
        /* closing is best effort */
      }
    } else {
      try {
        await port.close();
      } catch {
        /* the port may never have opened */
      }
    }
  }
}

const shortHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');

function provenanceLine(image: PreparedFirmwareImage): string {
  switch (image.provenance) {
    case 'stock':
      return `Firmware: stock ${image.stockVersion}`;
    case 'bundled':
      return `Firmware: release ${image.releaseTag ?? image.patchVersion ?? '?'} (bundled, patch sha256 ${image.patchSha256 ?? '?'})`;
    case 'unreviewed':
      return `Firmware: user-supplied patch, sha256 ${image.patchSha256 ?? '?'}, version ${image.patchVersion ?? '?'}`;
  }
}

/** Plain-text summary for the operator to copy or download. Not persisted. */
export function formatFirmwareFlashSummary(outcome: FirmwareFlashOutcome): string {
  const { image } = outcome;
  const stock = getStockFirmwareDescriptor(outcome.radioId);
  const lines: string[] = [
    'Codeplug Studio firmware flash',
    `Result: ${outcome.ok ? 'OK' : 'FAILED'}`,
    `Radio: ${stock.label}`,
    provenanceLine(image),
    `Stock version: ${image.stockVersion}`,
  ];
  for (const m of stock.members) lines.push(`Stock ${m.role} sha256: ${m.sha256}`);
  for (const [role, sha] of Object.entries(image.sha256)) {
    lines.push(`Flashed ${role} sha256: ${sha}`);
  }
  if (image.versionStamp) lines.push(`Version stamp: ${image.versionStamp}`);
  if (outcome.ident) {
    lines.push(`Bootloader: ${outcome.ident.model} (${shortHex(outcome.ident.raw)})`);
  }
  if (outcome.ok) {
    const { result } = outcome;
    lines.push(
      `Frames sent: ${result.framesSent} (${result.dataFrames} data)`,
      `Elapsed: ${(result.elapsedMs / 1000).toFixed(1)} s`,
      `End: ${result.end}`,
    );
  } else {
    lines.push(
      `Error code: ${outcome.code}`,
      `Error: ${outcome.message}`,
      `Stopped at: ${outcome.position}`,
      `Radio touched: ${outcome.radioTouched ? 'yes' : 'no'}`,
    );
  }
  lines.push(`Studio ${__BUILD_VERSION__} (${__BUILD_ENV__})`, `Started: ${outcome.startedAt}`);
  return lines.join('\n');
}
