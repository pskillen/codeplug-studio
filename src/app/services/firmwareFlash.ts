/**
 * Thin orchestration for the firmware flasher. No protocol or radio knowledge: radio facts come from descriptors,
 * verification from core, frames from the radio's updater. Nothing here is persisted. See DESIGN.md — Firmware
 * flashing and docs/features/firmware-flashing/.
 */
import { FirmwareError } from '@core/firmware/errors.ts';
import { listKnownPatchedResults } from '@core/firmware/releases/index.ts';
import { createPublishedFirmwareReleaseSource } from '@core/firmware/releases/publishedSource.ts';
import type {
  FirmwareReleaseSummary,
  LoadedFirmwarePatch,
  PublishedFirmwareRelease,
} from '@core/firmware/releases/types.ts';
import { createUserPatchSource } from '@core/firmware/releases/userPatchSource.ts';
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
  type FirmwareTarget,
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
  type FirmwareFlashTiming,
  type FirmwareUpdaterDescriptor,
  type SerialPortLike,
} from '@integrations/radio-io';
import { createPublicReleaseIndexLoader } from '@integrations/firmware-releases/publicReleaseIndex.ts';

export type { VerifiedStockFirmware };

/** The firmware project's published releases, fetched once per page load (and again after a failure). */
const loadPublishedReleases = createPublicReleaseIndexLoader();
const publishedReleaseSource = createPublishedFirmwareReleaseSource(loadPublishedReleases);

/** Published rows when the list can be fetched; none when it cannot (stock and user patches still work). */
async function publishedRowsOrNone(): Promise<readonly PublishedFirmwareRelease[]> {
  try {
    return await loadPublishedReleases();
  } catch {
    return [];
  }
}

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
    knownPatchedResults: listKnownPatchedResults(radioId, await publishedRowsOrNone()),
  });
}

/** What the operator chose to flash. */
export type FirmwareChoice =
  | { kind: 'stock' }
  | { kind: 'release'; source: 'published'; summary: FirmwareReleaseSummary }
  | { kind: 'user-patch'; file: NamedBytes };

/** Throws FirmwareError when the release list cannot be fetched. */
export async function listPublishedReleases(
  radioId: FirmwareRadioId,
  includeRc: boolean,
): Promise<readonly FirmwareReleaseSummary[]> {
  return publishedReleaseSource.listReleases(radioId, { includeRc });
}

/** Load and check the chosen patch. FirmwareError codes pass through for the wizard to show. */
export async function loadChosenPatch(
  radioId: FirmwareRadioId,
  choice: Exclude<FirmwareChoice, { kind: 'stock' }>,
): Promise<LoadedFirmwarePatch> {
  if (choice.kind === 'release') {
    return publishedReleaseSource.loadPatch(radioId, choice.summary.key);
  }
  const source = createUserPatchSource(choice.file, { rows: await publishedRowsOrNone() });
  const [summary] = await source.listReleases(radioId, { includeRc: true });
  return source.loadPatch(radioId, summary!.key);
}

/**
 * Build the image for the choice, then run the updater's interlocks before any radio contact.
 * A patch choice needs its `loaded` patch.
 */
export async function prepareFlash(
  radioId: FirmwareRadioId,
  stock: VerifiedStockFirmware,
  choice: FirmwareChoice,
  loaded?: LoadedFirmwarePatch,
): Promise<PreparedFirmwareImage> {
  let target: FirmwareTarget;
  if (choice.kind === 'stock') {
    target = { kind: 'stock' };
  } else {
    if (!loaded) throw new Error('The chosen patch has not been loaded.');
    target = { kind: 'patch', patch: loaded };
  }
  const image = await prepareFirmwareImage({
    descriptor: getStockFirmwareDescriptor(radioId),
    stock,
    target,
  });
  requireUpdater(radioId).createUpdater().checkImage(image);
  return image;
}

/** Stock-only shorthand for {@link prepareFlash}. */
export async function prepareStockFlash(
  radioId: FirmwareRadioId,
  stock: VerifiedStockFirmware,
): Promise<PreparedFirmwareImage> {
  return prepareFlash(radioId, stock, { kind: 'stock' });
}

/** Always a fresh pick, narrowed to the radio's cable. Call from a user gesture. */
export async function grantFirmwarePort(radioId: FirmwareRadioId): Promise<SerialPortLike> {
  return requestWebSerialPort(true, requireUpdater(radioId).link.usbFilters);
}

/** Fresh pick for the radio's normal-mode pre-flight probe. Call from a user gesture. */
export async function grantFirmwarePreflightPort(
  radioId: FirmwareRadioId,
): Promise<SerialPortLike> {
  const probe = requireUpdater(radioId).preflight?.probe;
  if (!probe) throw new Error(`${radioId} has no pre-flight probe.`);
  return requestWebSerialPort(true, probe.link.usbFilters);
}

export type FirmwarePreflightProbeOutcome =
  { ok: true; summary: string } | { ok: false; code: string; message: string };

/** Run the radio's read-only normal-mode probe. Always closes; never throws for a refusal. */
export async function runFirmwarePreflightProbe(input: {
  radioId: FirmwareRadioId;
  port: SerialPortLike;
  signal?: AbortSignal;
}): Promise<FirmwarePreflightProbeOutcome> {
  const { radioId, port, signal } = input;
  let pipe: BytePipe | null = null;
  try {
    const probe = requireUpdater(radioId).preflight?.probe;
    if (!probe) throw new Error(`${radioId} has no pre-flight probe.`);
    pipe = await openWebSerialPipe(port, probe.link.baudRate);
    const { summary } = await probe.run(pipe, { signal });
    return { ok: true, summary };
  } catch (err) {
    return { ok: false, code: errorCode(err), message: errorMessage(err) };
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
      /** Frame round-trip timing up to the failure, when the updater measures it. */
      timing?: FirmwareFlashTiming;
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
      timing: flashErr?.timing,
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
      return `Firmware: ${image.title}`;
    case 'published':
      return `Firmware: ${image.title} (published, patch sha256 ${image.patchSha256 ?? '?'})`;
    case 'unreviewed':
      return `Firmware: ${image.title} (user-supplied patch, sha256 ${image.patchSha256 ?? '?'}, version ${image.patchVersion ?? '?'})`;
  }
}

/** `mm:ss (s.s s)`. */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss} (${(ms / 1000).toFixed(1)} s)`;
}

function timingLine(t: FirmwareFlashTiming): string {
  const ms = (x: number) => (x < 10 ? x.toFixed(2) : x.toFixed(1));
  return `Frame round trip: median ${ms(t.medianFrameMs)} ms, p99 ${ms(t.p99FrameMs)} ms, max ${ms(t.maxFrameMs)} ms`;
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
      `Elapsed: ${formatElapsed(result.elapsedMs)}`,
      `End: ${result.end}`,
    );
    if (result.timing) lines.push(timingLine(result.timing));
  } else {
    lines.push(
      `Error code: ${outcome.code}`,
      `Error: ${outcome.message}`,
      `Stopped at: ${outcome.position}`,
      `Radio touched: ${outcome.radioTouched ? 'yes' : 'no'}`,
    );
    if (outcome.timing) lines.push(timingLine(outcome.timing));
  }
  lines.push(`Studio ${__BUILD_VERSION__} (${__BUILD_ENV__})`, `Started: ${outcome.startedAt}`);
  return lines.join('\n');
}
