/**
 * Thin orchestration for the firmware flasher. No protocol or radio knowledge: radio facts come from descriptors,
 * verification from core, frames from the radio's updater. Nothing here is persisted. See DESIGN.md — Firmware
 * flashing and docs/features/firmware-flashing/.
 */
import { FirmwareError } from '@core/firmware/errors.ts';
import { listKnownPatchedResults } from '@core/firmware/releases/index.ts';
import {
  fileBase,
  layoutFiles,
  loadedBases,
  loadedLayouts,
  patchForLayout,
} from '@core/firmware/releases/layouts.ts';
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
  type BytePipe,
  type FirmwareBootloaderIdent,
  type FirmwareFlashCount,
  type FirmwareFlashProgress,
  type FirmwareFlashResult,
  type FirmwareFlashTiming,
  type FirmwareSafetyBackupFileInfo,
  type FirmwareSafetyBackupOutcome,
  type ProgressFn,
  type FirmwareUpdaterDescriptor,
} from '@integrations/radio-io';
import { downloadZip } from '@integrations/download/browserDownload.ts';
import {
  findSafetyBackupRecord,
  recordSafetyBackup,
} from '@integrations/persistence/radioSafetyBackupRecords.ts';
import { createPublicReleaseIndexLoader } from '@integrations/firmware-releases/publicReleaseIndex.ts';

import {
  closeUnopenedFirmwarePort,
  grantFirmwareLinkPort,
  openFirmwareLinkPipe,
  refuseOnCapacitor,
  requireWebSerialPort,
  type FirmwarePort,
} from './firmwarePort.ts';
import { openWithBaudFallback } from './serialBaudFallback.ts';

export type { FirmwarePort };

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
  /**
   * Patch files from disk: one, or for a radio with release layouts one per layout (`file` plus `otherFiles`). Prepare
   * picks the file for the radio's layout.
   */
  | { kind: 'user-patch'; file: NamedBytes; otherFiles?: readonly NamedBytes[] }
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
  const files =
    choice.kind === 'user-patch' ? [choice.file, ...(choice.otherFiles ?? [])] : [choice.file];
  const source = createUserPatchSource(files, { rows: await publishedRowsOrNone() });
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
 * The refusal at Prepare for a release with files by layout but none for this radio: none for its layout or, where the
 * radio's stock base is known, none on that base. Where the release has the radio's base but not its layout
 * (`layoutsOnBase`, the layouts it has on that base), the refusal says in plain words that the radio's flash is laid out
 * differently from the one that file was built for. Never the nearest build
 * instead. The flash layout is an internal detail (#1670): the refusal names the radio's firmware, never a layout; with
 * developer mode on, Prepare shows the layout beside it.
 */
export const NO_FILE_FOR_LAYOUT = (
  _layout: string,
  _have: readonly string[],
  base?: string,
  haveBases: readonly string[] = [],
  layoutsOnBase: readonly string[] = [],
): string => {
  if (base === undefined) {
    return "Not available in this release: it has no file for this radio's firmware.";
  }
  if (layoutsOnBase.length) {
    return `Not available in this release: this radio runs ${base}, but its flash is laid out differently from the radios this release's ${base} file was built for, so that file can't be installed on it. Use a release that has a file for this radio.`;
  }
  return `Not available in this release: there is no MM9PDY build for this radio (${base}) yet.${haveBases.length ? ` This release has a file only for ${haveBases.join(' and ')}.` : ''}`;
};

/**
 * False when the loaded release has files by layout but none for `radioLayout` (and, where known, the radio's stock
 * `base`): Prepare then stops before building anything. True for a release with no files by layout, or a radio whose
 * layout is unknown.
 */
export function releaseHasFileForLayout(
  loaded: LoadedFirmwarePatch,
  radioLayout: string | undefined,
  base?: string,
): boolean {
  return radioLayout === undefined || patchForLayout(loaded, radioLayout, base) !== undefined;
}

/** The refusal text for a release with no file for this radio, from what the release has. */
export function noFileForRadioMessage(
  loaded: LoadedFirmwarePatch,
  radioLayout: string,
  base?: string,
): string {
  const layoutsOnBase =
    base === undefined
      ? []
      : layoutFiles(loaded).flatMap((f) =>
          fileBase(f) === base && f.layout !== undefined ? [f.layout] : [],
        );
  return NO_FILE_FOR_LAYOUT(
    radioLayout,
    loadedLayouts(loaded),
    base,
    loadedBases(loaded),
    layoutsOnBase,
  );
}

/**
 * The file of the loaded release to prepare for the radio's layout, and where known its stock base. A patch with no
 * files by layout, or a radio whose layout Studio doesn't know, is returned as is: the radio's interlocks decide. Throws
 * FirmwareError('patch-wrong-layout') when the release has files by layout but none for this radio.
 */
export function pickPatchForLayout(
  loaded: LoadedFirmwarePatch,
  radioLayout: string | undefined,
  radioCodeBase?: string,
): LoadedFirmwarePatch {
  if (radioLayout === undefined) return loaded;
  const picked = patchForLayout(loaded, radioLayout, radioCodeBase);
  if (!picked) {
    throw new FirmwareError(
      'patch-wrong-layout',
      noFileForRadioMessage(loaded, radioLayout, radioCodeBase),
    );
  }
  return picked;
}

/**
 * Build the image for the choice, then run the updater's interlocks before any radio contact.
 * A patch choice needs its `loaded` patch; for a release with one file per flash layout, the radio's file is picked
 * ({@link pickPatchForLayout}). `radioLayout` is the radio's flash layout, where Studio knows it;
 * `radioBuild` is the build name the radio gave about itself, which an updater compares with the image's own;
 * `reinstallConfirmed` is the operator's explicit confirm to write the build the radio already runs. Without it, an
 * updater that allows that throws `RadioConfirmRequiredError` (code `needsConfirm`) with the warning to show.
 * `radioReported` says the radio reported about itself, so it runs a modded build even where it named none.
 * `radioCodeBase` is the stock base the radio's own code is built on, where it said so; an updater refuses a file on
 * another base.
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
  radioCodeBase?: string,
): Promise<PreparedFirmwareImage> {
  let target: FirmwareTarget;
  if (choice.kind === 'stock') {
    target = { kind: 'stock' };
  } else {
    if (!loaded) throw new Error('The chosen patch has not been loaded.');
    target = { kind: 'patch', patch: pickPatchForLayout(loaded, radioLayout, radioCodeBase) };
  }
  const image = await prepareFirmwareImage({
    descriptor: getStockFirmwareDescriptor(radioId),
    stock,
    target,
    radioLayout,
    radioBuild,
    reinstallConfirmed,
    radioReported,
    radioCodeBase,
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

/**
 * Always a fresh pick, narrowed to the radio's cable: Web Serial's picker, or in the Android app the one attached
 * device matching the cable. Call from a user gesture.
 */
export async function grantFirmwarePort(radioId: FirmwareRadioId): Promise<FirmwarePort> {
  return grantFirmwareLinkPort(requireUpdater(radioId).link);
}

const SAFETY_BACKUP_STEP = 'The safety backup';

/**
 * Fresh pick for the radio's normal-mode pre-flight probe, narrowed to the probe's cable: Web Serial's picker, or in
 * the Android app the one attached device matching it. Call from a user gesture.
 */
export async function grantFirmwarePreflightPort(radioId: FirmwareRadioId): Promise<FirmwarePort> {
  const probe = requireUpdater(radioId).preflight?.probe;
  if (!probe) throw new Error(`${radioId} has no pre-flight probe.`);
  return grantFirmwareLinkPort(probe.link);
}

export type FirmwarePreflightProbeOutcome =
  { ok: true; summary: string } | { ok: false; code: string; message: string };

/** Run the radio's read-only normal-mode probe. Always closes; never throws for a refusal. */
export async function runFirmwarePreflightProbe(input: {
  radioId: FirmwareRadioId;
  port: FirmwarePort;
  signal?: AbortSignal;
}): Promise<FirmwarePreflightProbeOutcome> {
  const { radioId, port, signal } = input;
  let pipe: BytePipe | null = null;
  try {
    const probe = requireUpdater(radioId).preflight?.probe;
    if (!probe) throw new Error(`${radioId} has no pre-flight probe.`);
    pipe = await openFirmwareLinkPipe(port, probe.link.baudRate, probe.link);
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
        await closeUnopenedFirmwarePort(port);
      } catch {
        /* the port may never have opened */
      }
    }
  }
}

/**
 * Fresh pick for the radio report read on Prepare: Web Serial's picker, or in the Android app the one attached device
 * matching the cable. Call from a user gesture.
 */
export async function grantFirmwareRadioReportPort(
  radioId: FirmwareRadioId,
): Promise<FirmwarePort> {
  const report = requireUpdater(radioId).radioReport;
  if (!report) throw new Error(`${radioId} has no radio report.`);
  return grantFirmwareLinkPort(report.link);
}

export type FirmwareRadioReportOutcome =
  { ok: true; bytes: Uint8Array } | { ok: false; code: string; message: string };

/**
 * Read the radio's report in normal mode: read-only, one handshake and one read. Opens and retries as the codeplug
 * session does: when the handshake gets no answer at the link's rate, once more at the reader's fallback rate. Always
 * closes; never throws.
 */
export async function readFirmwareRadioReport(input: {
  radioId: FirmwareRadioId;
  port: FirmwarePort;
  signal?: AbortSignal;
}): Promise<FirmwareRadioReportOutcome> {
  const { radioId, port, signal } = input;
  let pipe: BytePipe | null = null;
  try {
    const report = requireUpdater(radioId).radioReport;
    if (!report) throw new Error(`${radioId} has no radio report.`);
    const bauds = report.baudRateFallback
      ? [report.link.baudRate, report.baudRateFallback]
      : [report.link.baudRate];
    const opened = await openWithBaudFallback({
      bauds,
      open: (baud) => openFirmwareLinkPipe(port, baud, report.link),
      handshake: (p) => report.read(p, { signal }),
    });
    pipe = opened.pipe;
    return { ok: true, bytes: opened.result };
  } catch (err) {
    return { ok: false, code: errorCode(err), message: errorMessage(err) };
  } finally {
    try {
      await (pipe ? pipe.close() : closeUnopenedFirmwarePort(port));
    } catch {
      /* closing is best effort; the port may never have opened */
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

/** Fresh pick for the safety backup's normal-mode link (Web Serial only). Call from a user gesture. */
export async function grantFirmwareSafetyBackupPort(
  radioId: FirmwareRadioId,
): Promise<FirmwarePort> {
  const sb = requireSafetyBackup(radioId);
  refuseOnCapacitor(SAFETY_BACKUP_STEP);
  return grantFirmwareLinkPort(sb.link);
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
  port: FirmwarePort;
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
    pipe = await openWebSerialPipe(
      requireWebSerialPort(port, SAFETY_BACKUP_STEP),
      sb.link.baudRate,
      {
        raiseDtrRts: sb.link.raiseDtrRts,
      },
    );
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
        await closeUnopenedFirmwarePort(port);
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
      /** The last written / total the updater reported, when it knows a total. */
      written?: FirmwareFlashCount;
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
      /** From connecting to the stop. */
      elapsedMs?: number;
      /** The last written / total the updater reported, when it knows a total. */
      written?: FirmwareFlashCount;
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
  port: FirmwarePort;
  onIdent?: (ident: FirmwareBootloaderIdent) => void;
  onProgress: (p: FirmwareFlashProgress) => void;
  signal: AbortSignal;
}): Promise<FirmwareFlashOutcome> {
  const { radioId, image, port, signal } = input;
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  let written: FirmwareFlashCount | undefined;
  const onProgress = (p: FirmwareFlashProgress) => {
    if (p.written) written = p.written;
    input.onProgress(p);
  };
  let pipe: BytePipe | null = null;
  let ident: FirmwareBootloaderIdent | undefined;
  let stage = 'connect';
  try {
    const descriptor = requireUpdater(radioId);
    pipe = await openFirmwareLinkPipe(port, descriptor.link.baudRate, descriptor.link);
    const updater = descriptor.createUpdater();
    stage = 'identify';
    ident = await updater.identify(pipe, { signal });
    input.onIdent?.(ident);
    stage = 'flash';
    const result = await updater.flash(image, { onProgress, signal });
    return { ok: true, radioId, image, ident, result, startedAt, ...(written ? { written } : {}) };
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
      elapsedMs: Date.now() - startedMs,
      ...(written ? { written } : {}),
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
        await closeUnopenedFirmwarePort(port);
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

/** `Written: 478 / 478 blocks`: distinct blocks or bytes the radio took, not requests. */
function writtenLine(w: FirmwareFlashCount): string {
  return `Written: ${w.done} / ${w.total} ${w.unit}`;
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
    if (outcome.written) lines.push(writtenLine(outcome.written));
    if (result.timing) lines.push(timingLine(result.timing));
    if (result.note) lines.push(`Note: ${result.note}`);
  } else {
    lines.push(
      `Error code: ${outcome.code}`,
      `Error: ${outcome.message}`,
      `Stopped at: ${outcome.position}`,
      `Radio touched: ${outcome.radioTouched ? 'yes' : 'no'}`,
    );
    if (outcome.elapsedMs !== undefined) lines.push(`Elapsed: ${formatElapsed(outcome.elapsedMs)}`);
    if (outcome.written) lines.push(writtenLine(outcome.written));
    if (outcome.timing) lines.push(timingLine(outcome.timing));
  }
  lines.push(`Studio ${__BUILD_VERSION__} (${__BUILD_ENV__})`, `Started: ${outcome.startedAt}`);
  return lines.join('\n');
}
