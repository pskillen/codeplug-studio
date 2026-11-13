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
import { stockVariantFor, toStockVariantFor } from '@core/firmware/stockVariants.ts';
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
  type FirmwareSafetyBackupFileInfo,
  type FirmwareSafetyBackupOutcome,
  type ProgressFn,
  type FirmwareUpdaterDescriptor,
  type SerialPortLike,
} from '@integrations/radio-io';
import { downloadZip } from '@integrations/download/browserDownload.ts';
import {
  findSafetyBackupRecord,
  recordSafetyBackup,
} from '@integrations/persistence/radioSafetyBackupRecords.ts';
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
  | { kind: 'user-patch'; file: NamedBytes }
  /** A to-stock release patch from disk, for a radio whose way back to stock is one (`stockReturn`). */
  | { kind: 'back-to-stock'; file: NamedBytes };

/** The refusal for a file picked under "Back to stock" that is not a to-stock patch. */
export const NOT_TO_STOCK_PATCH_MESSAGE =
  "This file isn't a to-stock patch: it doesn't put back a stock Studio knows. Pick the to-stock file from the firmware project's release artifact.";

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
  const loaded = await source.loadPatch(radioId, summary!.key);
  if (
    choice.kind === 'back-to-stock' &&
    !toStockVariantFor(getStockFirmwareDescriptor(radioId), loaded.parsed.description)
  ) {
    throw new FirmwareError('patch-not-to-stock', NOT_TO_STOCK_PATCH_MESSAGE);
  }
  return loaded;
}

/**
 * Build the image for the choice, then run the updater's interlocks before any radio contact.
 * A patch choice needs its `loaded` patch. `radioLayout` is the radio's flash layout, where Studio knows it;
 * `radioBuild` is the build name the radio gave about itself, which an updater compares with the image's own;
 * `reinstallConfirmed` is the operator's explicit confirm to write the build the radio already runs. Without it, an
 * updater that allows that throws `RadioConfirmRequiredError` (code `needsConfirm`) with the warning to show.
 * `radioReported` says the radio reported about itself, so it runs a modded build even where it named none.
 */
export async function prepareFlash(
  radioId: FirmwareRadioId,
  stock: VerifiedStockFirmware,
  choice: FirmwareChoice,
  loaded?: LoadedFirmwarePatch,
  radioLayout?: string,
  radioBuild?: string,
  reinstallConfirmed?: boolean,
  radioReported?: boolean,
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
    radioLayout,
    radioBuild,
    reinstallConfirmed,
    radioReported,
  });
  if (choice.kind === 'back-to-stock' && !image.backToStock) {
    throw new FirmwareError('patch-not-to-stock', NOT_TO_STOCK_PATCH_MESSAGE);
  }
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
    pipe = await openWebSerialPipe(port, probe.link.baudRate, {
      raiseDtrRts: probe.link.raiseDtrRts,
    });
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

function requireSafetyBackup(radioId: FirmwareRadioId) {
  const sb = requireUpdater(radioId).preflight?.safetyBackup;
  if (!sb) throw new Error(`${radioId} has no safety backup step.`);
  return sb;
}

/** Normalised radio key for a typed serial; '' when invalid. */
export function safetyBackupRadioKey(radioId: FirmwareRadioId, serial: string): string {
  return requireSafetyBackup(radioId).normaliseSerial(serial);
}

/** Fresh pick for the safety backup's normal-mode link. Call from a user gesture. */
export async function grantFirmwareSafetyBackupPort(
  radioId: FirmwareRadioId,
): Promise<SerialPortLike> {
  return requestWebSerialPort(true, requireSafetyBackup(radioId).link.usbFilters);
}

export type FirmwareSafetyBackupRunOutcome =
  { ok: true; outcome: FirmwareSafetyBackupOutcome } | { ok: false; code: string; message: string };

/**
 * Identify the radio, and take a read-only backup unless one is already recorded for this serial. A taken
 * backup is downloaded here but NOT recorded: recording waits for {@link recordFirmwareSafetyBackupSaved}.
 * Always closes; never throws for a refusal.
 */
export async function runFirmwareSafetyBackup(input: {
  radioId: FirmwareRadioId;
  port: SerialPortLike;
  serial: string;
  signal?: AbortSignal;
  onProgress?: ProgressFn;
}): Promise<FirmwareSafetyBackupRunOutcome> {
  const { radioId, port, serial, signal, onProgress } = input;
  let pipe: BytePipe | null = null;
  try {
    const sb = requireSafetyBackup(radioId);
    const radioKey = sb.normaliseSerial(serial);
    if (!radioKey) throw new Error("Type the radio's serial number first (it is on the label).");
    pipe = await openWebSerialPipe(port, sb.link.baudRate, { raiseDtrRts: sb.link.raiseDtrRts });
    const outcome = await sb.run(pipe, {
      serial: serial.trim(),
      radioKey,
      signal,
      onProgress,
      isSaved: (k) => findSafetyBackupRecord(sb.recordFamily, k) !== undefined,
    });
    if (outcome.kind === 'taken') downloadZip(outcome.zipBytes, outcome.fileName);
    return { ok: true, outcome };
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

/** Write the "saved" record (no bytes). Call only from the operator's tick. False when storage refused. */
export function recordFirmwareSafetyBackupSaved(
  radioId: FirmwareRadioId,
  saved: Pick<
    FirmwareSafetyBackupFileInfo,
    'radioKey' | 'region' | 'fileName' | 'sha256' | 'fingerprint'
  >,
): boolean {
  const sb = requireSafetyBackup(radioId);
  return recordSafetyBackup({
    family: sb.recordFamily,
    radioKey: saved.radioKey,
    region: saved.region === 'full' ? 'full' : 'cal',
    fileName: saved.fileName,
    sha256: saved.sha256,
    fingerprint: saved.fingerprint,
    savedAt: new Date().toISOString(),
    studioVersion: typeof __BUILD_VERSION__ === 'string' ? __BUILD_VERSION__ : 'local',
  });
}

export type FirmwareSafetyBackupFileOutcome =
  | { ok: true; info: FirmwareSafetyBackupFileInfo; recorded: boolean }
  | { ok: false; message: string };

/** Verify a backup file the operator already has and record it. A bad file records nothing. */
export async function recordFirmwareSafetyBackupFile(
  radioId: FirmwareRadioId,
  bytes: Uint8Array,
  fallbackSerial: string,
): Promise<FirmwareSafetyBackupFileOutcome> {
  try {
    const info = await requireSafetyBackup(radioId).verifyFile(bytes, { fallbackSerial });
    return { ok: true, info, recorded: recordFirmwareSafetyBackupSaved(radioId, info) };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
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
    pipe = await openWebSerialPipe(port, descriptor.link.baudRate, {
      raiseDtrRts: descriptor.link.raiseDtrRts,
    });
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
  const what = image.backToStock ? `back to stock, ${image.title}` : image.title;
  switch (image.provenance) {
    case 'stock':
      return `Firmware: ${what}`;
    case 'published':
      return `Firmware: ${what} (published, patch sha256 ${image.patchSha256 ?? '?'})`;
    case 'unreviewed':
      return `Firmware: ${what} (user-supplied patch, sha256 ${image.patchSha256 ?? '?'}, version ${image.patchVersion ?? '?'})`;
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
  const radioStock = getStockFirmwareDescriptor(outcome.radioId);
  const stock = stockVariantFor(radioStock, image.stockVersion) ?? radioStock;
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
    if (outcome.ident.version) lines.push(`Radio state: ${outcome.ident.version}`);
  }
  if (outcome.ok) {
    const { result } = outcome;
    lines.push(
      `Frames sent: ${result.framesSent} (${result.dataFrames} data)`,
      `Elapsed: ${formatElapsed(result.elapsedMs)}`,
      `End: ${result.end}`,
    );
    if (result.timing) lines.push(timingLine(result.timing));
    if (result.note) lines.push(`Note: ${result.note}`);
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
